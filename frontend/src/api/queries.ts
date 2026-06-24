import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── PIPELINE ───────────────────────────────────────────────────────────────

export const usePipelineStatus = () => {
  return useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: async () => {
      const response = await apiClient.get('/pipeline/status');
      return response.data;
    },
    refetchInterval: 1500,
  });
};

export const usePipelineRuns = () => {
  return useQuery({
    queryKey: ['pipeline', 'runs'],
    queryFn: async () => {
      const response = await apiClient.get('/pipeline/runs');
      return response.data;
    }
  });
};

export const usePipelineRun = (runId?: string) => {
  return useQuery({
    queryKey: ['pipeline', 'run', runId],
    queryFn: async () => {
      const response = await apiClient.get(`/pipeline/run/${runId}`);
      return response.data;
    },
    enabled: !!runId,
    refetchInterval: (data: any) => {
      if (!data) return 1500;
      const status = data?.overall_status || data?.status;
      if (status === 'COMPLETE' || status === 'ERROR' || status === 'REJECTED' || status === 'HUMAN_REVIEW') return false;
      return 1500;
    },
  });
};

export const usePipelineLogs = (runId?: string) => {
  return useQuery({
    queryKey: ['pipeline', 'logs', runId],
    queryFn: async () => {
      if (!runId) return { logs: [] };
      const response = await apiClient.get(`/pipeline/run/${runId}`);
      return response.data;
    },
    enabled: !!runId,
    refetchInterval: 1500,
  });
};

export const useTriggerPipeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { pdf_url?: string; file?: File }) => {
      const formData = new FormData();
      if (data.file) {
        formData.append('file', data.file);
      } else if (data.pdf_url) {
        formData.append('pdf_url', data.pdf_url);
      }
      const response = await apiClient.post('/guidelines/upload', formData);
      return response.data; // { status, guideline_id, run_id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'runs'] });
    }
  });
};

export const useApprovePipelineRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const response = await apiClient.post(`/pipeline/run/${runId}/approve`);
      return response.data;
    },
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'run', runId] });
    }
  });
};

export const useRejectPipelineRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const response = await apiClient.post(`/pipeline/run/${runId}/reject`);
      return response.data;
    },
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'run', runId] });
    }
  });
};

// ─── PATIENTS ───────────────────────────────────────────────────────────────

export const usePatients = (siteId?: string, isFlagged?: boolean) => {
  return useQuery({
    queryKey: ['patients', { siteId, isFlagged }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.append('site_id', siteId);
      const response = await apiClient.get(`/patients?${params.toString()}`);
      return response.data;
    }
  });
};

export const usePatient = (id: string) => {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      const response = await apiClient.get(`/patients/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const usePatientReadings = (id: string) => {
  return useQuery({
    queryKey: ['patients', id, 'readings'],
    queryFn: async () => {
      const response = await apiClient.get(`/patients/${id}/readings`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const usePatientStats = () => {
  return useQuery({
    queryKey: ['patients', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/patients/stats');
      return response.data;
    }
  });
};

export const useNotifyDoctor = () => {
  return useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiClient.post(`/patients/${patientId}/notify`);
      return response.data;
    }
  });
};

export const useExportPatients = () => {
  return useMutation({
    mutationFn: async (siteId?: string) => {
      const params = new URLSearchParams({ export: 'csv' });
      if (siteId) params.append('site_id', siteId);
      const response = await apiClient.get(`/patients?${params.toString()}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patients_${siteId || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    }
  });
};

// ─── RULES & GUIDELINES ─────────────────────────────────────────────────────

export const useRulesHistory = () => {
  return useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const response = await apiClient.get('/rules');
      return response.data;
    }
  });
};

export const usePendingRules = () => {
  return useQuery({
    queryKey: ['rules', 'pending'],
    queryFn: async () => {
      const response = await apiClient.get('/rules?status=PENDING');
      return response.data;
    },
    refetchInterval: 3000,
  });
};

export const useApproveRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/rules/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    }
  });
};

export const useRejectRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/rules/${id}/reject`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    }
  });
};

export const useGuidelineCount = () => {
  return useQuery({
    queryKey: ['guidelines', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/guidelines/stats/count');
      return response.data;
    }
  });
};

// ─── REPORTS ────────────────────────────────────────────────────────────────

export const useReports = () => {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const response = await apiClient.get('/reports');
      return response.data;
    }
  });
};

export const useDownloadReport = () => {
  return useMutation({
    mutationFn: async (reportId: number) => {
      const response = await apiClient.get(`/reports/${reportId}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PV_Report_${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    }
  });
};

export const usePatientCopilot = () => {
  return useMutation({
    mutationFn: async ({ patientId, question }: { patientId: string; question: string }) => {
      const response = await apiClient.post(`/patients/${patientId}/copilot`, { question });
      return response.data;
    }
  });
};
