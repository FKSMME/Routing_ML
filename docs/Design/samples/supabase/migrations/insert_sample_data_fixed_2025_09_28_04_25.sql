-- Insert sample ML model data
INSERT INTO public.ml_model_data_2025_09_28_04_25 (model_name, model_type, training_date, feature_weights, metrics, visualization_data) VALUES
('ProductRoutingModel_v1', 'RandomForest', NOW() - INTERVAL '7 days', 
 '{"material_type": 0.25, "complexity": 0.30, "size": 0.20, "tolerance": 0.15, "surface_finish": 0.10}',
 '{"accuracy": 0.87, "precision": 0.84, "recall": 0.89, "f1_score": 0.86}',
 '{"confusion_matrix": [[45, 5], [3, 47]], "feature_importance": [0.25, 0.30, 0.20, 0.15, 0.10]}'),
('ProductRoutingModel_v2', 'GradientBoosting', NOW() - INTERVAL '3 days',
 '{"material_type": 0.28, "complexity": 0.32, "size": 0.18, "tolerance": 0.12, "surface_finish": 0.10}',
 '{"accuracy": 0.91, "precision": 0.88, "recall": 0.93, "f1_score": 0.90}',
 '{"confusion_matrix": [[48, 2], [2, 48]], "feature_importance": [0.28, 0.32, 0.18, 0.12, 0.10]}');

-- Insert sample routing elements and system options
INSERT INTO public.system_options_2025_09_28_04_25 (option_category, option_name, option_value) VALUES
('routing_elements', 'available_operations', 
 '["밀링", "선반", "드릴링", "연삭", "용접", "조립", "검사", "열처리", "표면처리", "포장"]'),
('standard_deviation', 'z_score_options', 
 '{"1_sigma": 1.0, "2_sigma": 2.0, "3_sigma": 3.0}'),
('similarity_search', 'search_methods', 
 '["코사인 유사도", "유클리드 거리", "맨하탄 거리", "자카드 유사도"]'),
('column_mapping', 'reference_columns',
 '["product_code", "material_type", "complexity", "size", "tolerance", "surface_finish", "weight", "volume"]'),
('output_formats', 'supported_formats',
 '["CSV", "XML", "JSON", "Excel", "ACCESS"]');

-- Insert sample product reference data
INSERT INTO public.product_reference_data_2025_09_28_04_25 (product_name, product_code, matrix_data) VALUES
('샘플 제품 A', 'PROD_A_001', 
 '{"material_type": "알루미늄", "complexity": "중간", "size": "소형", "tolerance": "±0.1mm", "surface_finish": "Ra 1.6", "weight": 0.5, "volume": 125.0}'),
('샘플 제품 B', 'PROD_B_002',
 '{"material_type": "스테인리스", "complexity": "복잡", "size": "대형", "tolerance": "±0.05mm", "surface_finish": "Ra 0.8", "weight": 2.3, "volume": 850.0}'),
('샘플 제품 C', 'PROD_C_003',
 '{"material_type": "탄소강", "complexity": "단순", "size": "중형", "tolerance": "±0.2mm", "surface_finish": "Ra 3.2", "weight": 1.2, "volume": 400.0}');

-- Insert sample algorithm settings
INSERT INTO public.algorithm_settings_2025_09_28_04_25 (name, algorithm_type, parameters, workflow_graph) VALUES
('기본 라우팅 예측', 'RandomForest', 
 '{"n_estimators": 100, "max_depth": 10, "min_samples_split": 2}',
 '{"nodes": [{"id": "input", "type": "input", "label": "제품 데이터"}, {"id": "preprocess", "type": "process", "label": "전처리"}, {"id": "predict", "type": "model", "label": "예측 모델"}, {"id": "output", "type": "output", "label": "라우팅 결과"}], "connections": [{"from": "input", "to": "preprocess"}, {"from": "preprocess", "to": "predict"}, {"from": "predict", "to": "output"}]}');

-- Insert sample routing configuration
INSERT INTO public.routing_configurations_2025_09_28_04_25 (name, product_items, routing_sequence, settings) VALUES
('표준 가공 라우팅', ARRAY['PROD_A_001', 'PROD_B_002'],
 '{"sequence": [{"operation": "밀링", "time": 15, "machine": "CNC-001"}, {"operation": "드릴링", "time": 8, "machine": "DRILL-002"}, {"operation": "검사", "time": 5, "machine": "CMM-001"}]}',
 '{"auto_save": true, "format": "CSV", "include_timestamps": true}');