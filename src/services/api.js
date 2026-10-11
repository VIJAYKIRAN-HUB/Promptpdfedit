import axios from 'axios';

// Dynamically route API calls based on local vs production environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
  timeout: 30000,
});

export const api = {
  // Document Operations
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post('/api/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getDocument: async (documentId) => {
    const response = await client.get(`/api/documents/${documentId}`);
    return response.data;
  },

  getDocumentFileBlob: async (documentId, version = null) => {
    const url = `/api/documents/${documentId}/file${version ? `?version=${version}` : ''}`;
    const response = await client.get(url, { responseType: 'blob' });
    return response.data;
  },

  getDocumentFileUrl: (documentId, version = null) => {
    return `${API_BASE_URL}/api/documents/${documentId}/file${version ? `?version=${version}` : ''}`;
  },

  searchOccurrences: async (documentId, searchTerm, caseSensitive = false) => {
    const response = await client.get(`/api/documents/${documentId}/search`, {
      params: { q: searchTerm, case_sensitive: caseSensitive },
    });
    return response.data;
  },

  getTextElements: async (documentId, page = 1, version = null) => {
    const response = await client.get(`/api/documents/${documentId}/text-elements`, {
      params: { page, version },
    });
    return response.data;
  },

  // Edit Plans & AI Execution
  createEditPlan: async (documentId, prompt) => {
    const response = await client.post(`/api/edit-plans/${documentId}`, { prompt });
    return response.data;
  },

  applyEditPlan: async (documentId, operations, promptText) => {
    const response = await client.post(`/api/edit-plans/${documentId}/apply`, {
      operations,
      prompt_text: promptText,
    });
    return response.data;
  },

  // Image to PDF Conversion
  convertImagesToPdf: async (files, fitA4 = true, margin = 40) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('fit_a4', fitA4);
    formData.append('margin', margin);

    const response = await client.post('/api/documents/convert-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  convertImagesToPdfWithReportLab: async (files, sheetSettings = [], margin = 20) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (sheetSettings && sheetSettings.length > 0) {
      formData.append('sheet_settings', JSON.stringify(sheetSettings));
    }
    formData.append('margin', margin);

    const response = await client.post('/api/conversions/images-to-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  convertFreeformPagesToPdf: async (files, pagesPayload) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('pages_json', JSON.stringify(pagesPayload));

    const response = await client.post('/api/conversions/images-to-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Auto-Destruct Privacy Cleanup
  triggerCleanup: async (secret = '') => {
    const headers = secret ? { Authorization: `Bearer ${secret}` } : {};
    const response = await client.delete('/api/cron/cleanup', { headers });
    return response.data;
  },

  // Check Backend Health
  checkHealth: async () => {
    try {
      const response = await client.get('/api/health');
      return response.data;
    } catch (err) {
      return { status: 'offline', error: err.message };
    }
  },
};

export default api;
