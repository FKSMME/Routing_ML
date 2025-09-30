export interface SampleProduct {
  id: string;
  product_name: string;
  product_code: string;
  matrix_data: {
    material_type: string;
    complexity: string;
    size: string;
    tolerance: string;
    surface_finish: string;
  };
  created_at: string;
}

export interface SampleModel {
  id: string;
  model_name: string;
  model_type: string;
  training_date: string;
  feature_weights: Record<string, number>;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
  };
  visualization_data: {
    feature_importance: Array<{ feature: string; weight: number }>;
    confusion_matrix: number[][];
    training_progress: Array<{ epoch: number; accuracy: number; loss: number }>;
  };
}

export interface SampleWorkflowRecord {
  id: string;
  name: string;
  created_at: string;
  algorithm_type: string;
  parameters: Record<string, any>;
  workflow_graph: {
    nodes: Array<{
      id: string;
      type: 'input' | 'process' | 'model' | 'output';
      label: string;
      x: number;
      y: number;
      parameters?: Record<string, any>;
    }>;
    connections: Array<{ from: string; to: string }>;
  };
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'prod-001',
    product_name: '정밀 샤프트',
    product_code: 'PROD_A_001',
    matrix_data: {
      material_type: '알루미늄 6061',
      complexity: '중간',
      size: '소형',
      tolerance: '±0.05mm',
      surface_finish: 'Ra 1.6'
    },
    created_at: '2024-09-12T09:00:00Z'
  },
  {
    id: 'prod-002',
    product_name: '기어 하우징',
    product_code: 'PROD_B_014',
    matrix_data: {
      material_type: '주철 FCD450',
      complexity: '높음',
      size: '중형',
      tolerance: '±0.03mm',
      surface_finish: 'Ra 0.8'
    },
    created_at: '2024-09-11T11:30:00Z'
  },
  {
    id: 'prod-003',
    product_name: '서보 모터 플랜지',
    product_code: 'PROD_C_008',
    matrix_data: {
      material_type: '스테인리스 304',
      complexity: '중간',
      size: '소형',
      tolerance: '±0.02mm',
      surface_finish: 'Ra 1.2'
    },
    created_at: '2024-09-10T14:15:00Z'
  },
  {
    id: 'prod-004',
    product_name: '로봇 암 조인트',
    product_code: 'PROD_D_021',
    matrix_data: {
      material_type: '티타늄 Ti-6Al-4V',
      complexity: '높음',
      size: '중형',
      tolerance: '±0.01mm',
      surface_finish: 'Ra 0.6'
    },
    created_at: '2024-09-09T08:45:00Z'
  }
];

export const SAMPLE_ROUTING_OPERATIONS = [
  '밀링',
  '선반',
  '드릴링',
  '연삭',
  '탭핑',
  '세척',
  '검사'
];

export const SAMPLE_ROUTING_COLUMNS = [
  'product_code',
  'product_name',
  'matrix_data.material_type',
  'matrix_data.complexity',
  'matrix_data.size',
  'matrix_data.tolerance',
  'matrix_data.surface_finish'
];

export const SAMPLE_MODELS: SampleModel[] = [
  {
    id: 'model-001',
    model_name: 'RoutingPredictor_v1',
    model_type: 'Gradient Boosting',
    training_date: '2024-09-05T10:00:00Z',
    feature_weights: {
      material_type: 0.28,
      complexity: 0.21,
      size: 0.16,
      tolerance: 0.18,
      surface_finish: 0.17
    },
    metrics: {
      accuracy: 0.93,
      precision: 0.91,
      recall: 0.9,
      f1: 0.905
    },
    visualization_data: {
      feature_importance: [
        { feature: 'material_type', weight: 0.28 },
        { feature: 'complexity', weight: 0.21 },
        { feature: 'tolerance', weight: 0.18 },
        { feature: 'surface_finish', weight: 0.17 },
        { feature: 'size', weight: 0.16 }
      ],
      confusion_matrix: [
        [42, 3, 1],
        [4, 38, 2],
        [0, 2, 41]
      ],
      training_progress: [
        { epoch: 1, accuracy: 0.75, loss: 0.42 },
        { epoch: 2, accuracy: 0.81, loss: 0.36 },
        { epoch: 3, accuracy: 0.86, loss: 0.29 },
        { epoch: 4, accuracy: 0.9, loss: 0.24 },
        { epoch: 5, accuracy: 0.93, loss: 0.19 }
      ]
    }
  },
  {
    id: 'model-002',
    model_name: 'CycleTimeEstimator_v2',
    model_type: 'Neural Network',
    training_date: '2024-08-18T15:30:00Z',
    feature_weights: {
      material_type: 0.22,
      complexity: 0.27,
      size: 0.19,
      tolerance: 0.15,
      surface_finish: 0.17
    },
    metrics: {
      accuracy: 0.9,
      precision: 0.88,
      recall: 0.89,
      f1: 0.885
    },
    visualization_data: {
      feature_importance: [
        { feature: 'complexity', weight: 0.27 },
        { feature: 'material_type', weight: 0.22 },
        { feature: 'surface_finish', weight: 0.17 },
        { feature: 'size', weight: 0.19 },
        { feature: 'tolerance', weight: 0.15 }
      ],
      confusion_matrix: [
        [35, 5, 2],
        [3, 40, 4],
        [1, 4, 37]
      ],
      training_progress: [
        { epoch: 1, accuracy: 0.7, loss: 0.5 },
        { epoch: 2, accuracy: 0.78, loss: 0.41 },
        { epoch: 3, accuracy: 0.83, loss: 0.33 },
        { epoch: 4, accuracy: 0.87, loss: 0.27 },
        { epoch: 5, accuracy: 0.9, loss: 0.22 }
      ]
    }
  }
];

export const SAMPLE_WORKFLOWS: SampleWorkflowRecord[] = [
  {
    id: 'workflow-001',
    name: '기본 라우팅 워크플로우',
    created_at: '2024-09-03T13:00:00Z',
    algorithm_type: 'Custom',
    parameters: { version: '1.0.0' },
    workflow_graph: {
      nodes: [
        { id: 'n1', type: 'input', label: '제품 기준정보', x: 50, y: 80 },
        { id: 'n2', type: 'process', label: '특성 전처리', x: 220, y: 80, parameters: { scaler: 'StandardScaler' } },
        { id: 'n3', type: 'model', label: '라우팅 추천 모델', x: 390, y: 80, parameters: { algorithm: 'Gradient Boosting' } },
        { id: 'n4', type: 'output', label: '라우팅 시뮬레이터', x: 560, y: 80 }
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' }
      ]
    }
  },
  {
    id: 'workflow-002',
    name: '표준 시간 예측',
    created_at: '2024-08-21T09:20:00Z',
    algorithm_type: 'Batch Processing',
    parameters: { version: '2.1.0' },
    workflow_graph: {
      nodes: [
        { id: 'm1', type: 'input', label: '라우팅 로그', x: 50, y: 200 },
        { id: 'm2', type: 'process', label: '이상치 제거', x: 220, y: 200, parameters: { method: 'Z-Score' } },
        { id: 'm3', type: 'model', label: 'CycleTimeEstimator', x: 390, y: 200, parameters: { algorithm: 'Neural Network' } },
        { id: 'm4', type: 'output', label: '표준 시간 테이블', x: 560, y: 200 }
      ],
      connections: [
        { from: 'm1', to: 'm2' },
        { from: 'm2', to: 'm3' },
        { from: 'm3', to: 'm4' }
      ]
    }
  }
];

export const SAMPLE_STANDARD_DEVIATION = 2;
export const SAMPLE_SIMILARITY_METHOD = '코사인 유사도';

export const SAMPLE_ACTIVITY = [
  { action: '라우팅 생성', item: 'PROD_A_001', time: '5분 전', status: 'success' },
  { action: '모델 학습', item: 'RoutingPredictor_v1', time: '1시간 전', status: 'success' },
  { action: '데이터 업로드', item: '제품 기준정보', time: '2시간 전', status: 'success' },
  { action: '설정 변경', item: '출력 포맷', time: '3시간 전', status: 'success' }
];
