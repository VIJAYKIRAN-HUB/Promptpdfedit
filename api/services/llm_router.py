import os
import re
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Try importing Google Generative AI SDK safely
try:
    import google.generativeai as genai
except ImportError:
    genai = None

SYSTEM_INSTRUCTION = """
You are an expert document editing planner for PromptPDF.
Your goal is to parse natural language instructions from the user, inspect the provided PDF document text, and output a deterministic JSON array of PDF editing operations.

Allowed actions:
- "replace_text": Replace exact substring currently in the PDF with new text.
- "redact_text": Blank out sensitive text (replace_with: "").

Required JSON Schema:
Return ONLY a valid JSON array of objects conforming to this schema:
[
  {
    "action": "replace_text" | "redact_text",
    "find": "exact text substring as it appears in the PDF",
    "replace_with": "new replacement text to insert",
    "page": null or integer (1-indexed page number if specified, otherwise null),
    "confidence": float between 0.0 and 1.0,
    "explanation": "concise explanation of this change"
  }
]

CRITICAL RULES:
1. Return ONLY the raw JSON array. Do NOT wrap in markdown formatting (no ```json code blocks).
2. "find" MUST match the exact text present in the PDF context. For example:
   - If the user asks "change the cgpa as 10 in y2s4", look at the PDF text for Y2S4, locate the current CGPA number (e.g. "8.45"), and set "find": "8.45" and "replace_with": "10".
   - If user asks "change my name to Vijaykiran on page 1", find the existing name in the document and replace it.
3. If no valid replacement action can be inferred, output an empty JSON array: []
"""


class EditOperation(BaseModel):
    action: str = Field(..., description="Action type: replace_text or redact_text")
    find: str = Field(..., description="Target string to locate in PDF")
    replace_with: str = Field(default="", description="Text to insert")
    page: Optional[int] = Field(default=None, description="1-indexed page number, or null for all pages")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    explanation: Optional[str] = Field(default="")


def _heuristic_nlp_fallback(prompt: str, document_context: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Context-aware NLP heuristic fallback when GEMINI_API_KEY is not set or network is offline.
    Parses flexible syntax (change/set/replace ... as/to/with ...) and checks
    the actual PDF text context for attributes like CGPA, dates, names, or scopes (e.g. Y2S4).
    """
    operations: List[Dict[str, Any]] = []
    text = prompt.strip()

    # Detect target page if present (e.g. "on page 3", "page 1", "in p. 2")
    page_match = re.search(r'\b(?:on|in|for)?\s*page\s*(\d+)\b', text, re.IGNORECASE)
    target_page = int(page_match.group(1)) if page_match else None

    # Detect scope indicator (e.g. "in y2s4", "for semester 4", "in row y2s4")
    scope_match = re.search(r'\b(?:in|for|at|under|row|section|sem)\s+([a-zA-Z0-9_-]+)\b', text, re.IGNORECASE)
    scope_term = scope_match.group(1).lower() if scope_match and scope_match.group(1).lower() != "page" else None

    # Flexible Verb Pattern: replace / change / set / update / modify / make / switch / swap
    # Separators: with / to / by / as / into / =
    verb_regex = re.compile(
        r'(?:replace|change|switch|swap|set|update|modify|make|put|edit)\s+[\'"]?([^\'"]+?)[\'"]?\s+(?:with|to|by|as|into|=)\s+[\'"]?([^\'"]+?)[\'"]?(?:\s+(?:on|in|for)\s+.*|$|\.|\,)',
        re.IGNORECASE
    )
    matches = verb_regex.findall(text)

    for find_raw, replace_raw in matches:
        # Clean find term (strip leading "the", "a", "all", quotes)
        find_clean = re.sub(r'^(?:the|a|an|all)\s+', '', find_raw.strip().strip("'\""), flags=re.IGNORECASE).strip()

        # Clean replacement value (strip trailing scope clauses like "in y2s4")
        replace_val = re.split(r'\s+(?:in|on|for|at)\s+', replace_raw.strip().strip("'\""), flags=re.IGNORECASE)[0].strip()

        matched_context = False

        # If document context is available, resolve semantic fields (e.g. "cgpa", "sgpa", "marks", "date")
        if document_context:
            doc_lines = document_context.splitlines()
            target_lines = doc_lines

            # If user mentioned a scope (e.g. "y2s4"), filter or prioritize lines containing it
            if scope_term:
                filtered = [line for line in doc_lines if scope_term in line.lower()]
                if filtered:
                    target_lines = filtered

            # Search for field in document lines: e.g. "CGPA : 8.45" or "CGPA: 8.45" or "CGPA 8.45"
            field_regex = re.compile(rf'\b{re.escape(find_clean)}\s*[:=]?\s*([0-9A-Za-z.]+)\b', re.IGNORECASE)
            for line in target_lines:
                m = field_regex.search(line)
                if m:
                    actual_val = m.group(1)
                    operations.append({
                        "action": "replace_text",
                        "find": actual_val,
                        "replace_with": replace_val,
                        "page": target_page,
                        "confidence": 0.92,
                        "explanation": f"Replace current {find_clean.upper()} value '{actual_val}' with '{replace_val}'" + (f" in {scope_term.upper()}" if scope_term else "")
                    })
                    matched_context = True
                    break

        if not matched_context and find_clean and replace_val:
            operations.append({
                "action": "replace_text",
                "find": find_clean,
                "replace_with": replace_val,
                "page": target_page,
                "confidence": 0.85,
                "explanation": f"Replace '{find_clean}' with '{replace_val}'" + (f" on page {target_page}" if target_page else "")
            })

    # Pattern 2: Redactions & Smart PII Auto-Redaction
    if not operations:
        is_pii_prompt = bool(re.search(r'\b(pii|personal|sensitive|phone|email|ssn|social\s+security|confidential|id|identifier)\b', text, re.IGNORECASE))
        
        # Smart PII scanner if document context is available
        if is_pii_prompt and document_context:
            pii_found = set()
            
            # SSN Pattern: 000-00-0000
            if re.search(r'\b(pii|ssn|social\s+security|sensitive)\b', text, re.IGNORECASE):
                ssn_matches = re.findall(r'\b\d{3}-\d{2}-\d{4}\b', document_context)
                for ssn in ssn_matches:
                    pii_found.add((ssn, "SSN"))

            # Phone numbers
            if re.search(r'\b(pii|phone|number|mobile|sensitive)\b', text, re.IGNORECASE):
                phone_matches = re.findall(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', document_context)
                for ph in phone_matches:
                    pii_found.add((ph, "Phone Number"))

            # Emails
            if re.search(r'\b(pii|email|address|sensitive)\b', text, re.IGNORECASE):
                email_matches = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', document_context)
                for em in email_matches:
                    pii_found.add((em, "Email Address"))

            # Confidential IDs (e.g. ID-984210, ID: ID-984210, DOC-2026-9941)
            if re.search(r'\b(id|confidential|account|identifier)\b', text, re.IGNORECASE):
                id_matches = re.findall(r'\b(?:ID|DOC|ACC|REF)[-_]\w{4,10}\b', document_context, re.IGNORECASE)
                for id_val in id_matches:
                    pii_found.add((id_val, "Confidential ID"))

            for token, pii_type in pii_found:
                operations.append({
                    "action": "redact_text",
                    "find": token,
                    "replace_with": "",
                    "page": target_page,
                    "confidence": 0.95,
                    "explanation": f"Auto-redact detected {pii_type}: '{token}'"
                })

        # General Redaction Fallback
        if not operations:
            p2 = re.findall(
                r'(?:redact|remove|delete|erase|blank\s+out|hide)\s+[\'"]?([^\'"]+?)[\'"]?(?:\s+(?:on|in)\s+page\s+\d+|$|\.|\,)',
                text,
                re.IGNORECASE
            )
            for target in p2:
                target_clean = re.sub(r'^(?:the|a|an|all)\s+', '', target.strip().strip("'\""), flags=re.IGNORECASE)
                if target_clean:
                    operations.append({
                        "action": "redact_text",
                        "find": target_clean,
                        "replace_with": "",
                        "page": target_page,
                        "confidence": 0.85,
                        "explanation": f"Redact '{target_clean}'" + (f" on page {target_page}" if target_page else "")
                    })

    return operations


async def generate_edit_plan_from_prompt(user_prompt: str, document_context: Optional[str] = None) -> Dict[str, Any]:
    """
    Orchestrates Google Gemini API to parse natural language PDF edit instructions.
    Uses gemini-1.5-flash with JSON mode.
    Falls back gracefully to the deterministic heuristic engine if key is absent or API fails.
    """
    from dotenv import load_dotenv
    load_dotenv(override=True)
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    # Build prompt payload with document context
    content_prompt = f"User Instruction: {user_prompt}"
    if document_context:
        content_prompt += f"\n\nExtracted PDF Document Content:\n{document_context[:3000]}"

    # 1. Primary Route: Google Gemini API (gemini-1.5-flash)
    if gemini_key and not gemini_key.startswith("your-gemini"):
        if genai is not None:
            try:
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=SYSTEM_INSTRUCTION,
                    generation_config={
                        "response_mime_type": "application/json",
                        "temperature": 0.0,
                    }
                )

                response = model.generate_content(content_prompt)
                raw_json = response.text.strip() if response and response.text else "[]"

                # Clean markdown block markers if present
                clean_json = re.sub(r'^```json\s*|\s*```$', '', raw_json, flags=re.MULTILINE).strip()
                parsed = json.loads(clean_json)

                if isinstance(parsed, list):
                    validated = [EditOperation(**op).model_dump() for op in parsed]
                    return {
                        "provider": "gemini:gemini-1.5-flash",
                        "operations": validated,
                        "raw_prompt": user_prompt
                    }
            except Exception as e:
                print(f"Notice: Gemini SDK call error ({e}). Falling back to local engine.")
        else:
            print("Notice: google-generativeai package not installed yet. Run 'pip install google-generativeai'.")

    # 2. Fallback: Intelligent Deterministic Heuristic Engine
    fallback_ops = _heuristic_nlp_fallback(user_prompt, document_context=document_context)
    validated = [EditOperation(**op).model_dump() for op in fallback_ops]
    return {
        "provider": "heuristic_engine",
        "operations": validated,
        "raw_prompt": user_prompt,
        "note": "Parsed using local rule engine. Set GEMINI_API_KEY to activate Gemini 1.5 Flash."
    }


# Convenient alias
generate_edit_plan = generate_edit_plan_from_prompt
