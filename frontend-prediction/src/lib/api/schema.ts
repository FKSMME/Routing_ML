// Auto-generated from deliverables/openapi.json
// Do not edit manually.

export const openApiSchema = {
  "openapi": "3.1.0",
  "info": {
    "title": "Routing-ML API",
    "version": "0.1.0"
  },
  "paths": {
    "/api/auth/register": {
      "post": {
        "tags": [
          "auth"
        ],
        "summary": "Register",
        "operationId": "register_api_auth_register_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegisterRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegisterResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/login": {
      "post": {
        "tags": [
          "auth"
        ],
        "summary": "Login",
        "operationId": "login_api_auth_login_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LoginResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/me": {
      "get": {
        "tags": [
          "auth"
        ],
        "summary": "Read Current User",
        "operationId": "read_current_user_api_auth_me_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthenticatedUser"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/logout": {
      "post": {
        "tags": [
          "auth"
        ],
        "summary": "Logout",
        "operationId": "logout_api_auth_logout_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/admin/approve": {
      "post": {
        "tags": [
          "auth"
        ],
        "summary": "Approve User",
        "operationId": "approve_user_api_auth_admin_approve_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AdminApproveRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserStatusResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/admin/reject": {
      "post": {
        "tags": [
          "auth"
        ],
        "summary": "Reject User",
        "operationId": "reject_user_api_auth_admin_reject_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AdminRejectRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserStatusResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/health": {
      "get": {
        "tags": [
          "routing-ml"
        ],
        "summary": "Health Check",
        "description": "서비스 상태 확인.",
        "operationId": "health_check_api_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/predict": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "Predict",
        "description": "라우팅 예측 엔드포인트.",
        "operationId": "predict_api_predict_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PredictionRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PredictionResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/similarity/search": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "유사 품목 후보 검색",
        "description": "품목별 유사 후보를 조회한다.",
        "operationId": "similarity_search_api_similarity_search_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SimilaritySearchRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SimilaritySearchResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/groups/recommendations": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "품목 그룹 추천",
        "description": "예측 결과와 매니페스트를 바탕으로 그룹을 추천한다.",
        "operationId": "group_recommendations_api_groups_recommendations_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GroupRecommendationRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/GroupRecommendationResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/time/summary": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "공정 시간 요약",
        "description": "공정 데이터를 기반으로 리드타임을 집계한다.",
        "operationId": "time_summary_api_time_summary_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TimeSummaryRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TimeSummaryResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rules/validate": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "공정 규칙 검증",
        "description": "매니페스트 규칙을 기반으로 공정 데이터를 검증한다.",
        "operationId": "validate_rules_api_rules_validate_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RuleValidationRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RuleValidationResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/candidates/save": {
      "post": {
        "tags": [
          "routing-ml"
        ],
        "summary": "Save Candidate",
        "description": "후보 라우팅 저장.",
        "operationId": "save_candidate_api_candidates_save_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CandidateSaveRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CandidateSaveResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/metrics": {
      "get": {
        "tags": [
          "routing-ml"
        ],
        "summary": "Get Metrics",
        "description": "마지막 예측 메트릭 반환.",
        "operationId": "get_metrics_api_metrics_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "title": "Response Get Metrics Api Metrics Get"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/workflow/graph": {
      "get": {
        "tags": [
          "workflow-graph"
        ],
        "summary": "Get Workflow Graph",
        "description": "현재 워크플로우 그래프 및 런타임 설정을 반환한다.",
        "operationId": "get_workflow_graph_api_workflow_graph_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowConfigResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "workflow-graph"
        ],
        "summary": "Patch Workflow Graph",
        "description": "워크플로우 그래프와 런타임 설정을 갱신한다.",
        "operationId": "patch_workflow_graph_api_workflow_graph_patch",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/WorkflowConfigPatch"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkflowConfigResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/trainer/status": {
      "get": {
        "tags": [
          "trainer"
        ],
        "summary": "Get Training Status",
        "operationId": "get_training_status_api_trainer_status_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TrainingStatusModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/trainer/run": {
      "post": {
        "tags": [
          "trainer"
        ],
        "summary": "Run Training",
        "operationId": "run_training_api_trainer_run_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TrainingRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "403": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "null",
                  "title": "Response Run Training Api Trainer Run Post"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/trainer/versions": {
      "get": {
        "tags": [
          "trainer"
        ],
        "summary": "Get Model Versions",
        "operationId": "get_model_versions_api_trainer_versions_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "integer",
              "title": "Limit"
            },
            "name": "limit",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {
                    "$ref": "#/components/schemas/ModelVersionModel"
                  },
                  "type": "array",
                  "title": "Response Get Model Versions Api Trainer Versions Get"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/trainer/versions/{version_name}/activate": {
      "post": {
        "tags": [
          "trainer"
        ],
        "summary": "Activate Model Version",
        "operationId": "activate_model_version_api_trainer_versions__version_name__activate_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "string",
              "title": "Version Name"
            },
            "name": "version_name",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ModelVersionModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/settings/workspace": {
      "get": {
        "tags": [
          "workspace"
        ],
        "summary": "Get Workspace Settings",
        "operationId": "get_workspace_settings_api_settings_workspace_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkspaceSettingsResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "workspace"
        ],
        "summary": "Save Workspace Settings",
        "operationId": "save_workspace_settings_api_settings_workspace_put",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/WorkspaceSettingsPayload"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/WorkspaceSettingsResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/audit/ui": {
      "post": {
        "tags": [
          "workspace"
        ],
        "summary": "Record Ui Audit",
        "operationId": "record_ui_audit_api_audit_ui_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AuditEvent"
              }
            }
          },
          "required": true
        },
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/access/connection/test": {
      "post": {
        "tags": [
          "workspace"
        ],
        "summary": "Test MSSQL Connection",
        "operationId": "test_access_connection_api_access_connection_test_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AccessConnectionRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AccessConnectionResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/routing/groups": {
      "get": {
        "tags": [
          "routing-groups"
        ],
        "summary": "List Routing Groups",
        "operationId": "list_routing_groups_api_routing_groups_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 200.0,
              "minimum": 1.0,
              "title": "Limit",
              "default": 20
            },
            "name": "limit",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0.0,
              "title": "Offset",
              "default": 0
            },
            "name": "offset",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Owner"
            },
            "name": "owner",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Item Code"
            },
            "name": "item_code",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Search"
            },
            "name": "search",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RoutingGroupListResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "routing-groups"
        ],
        "summary": "Create Routing Group",
        "operationId": "create_routing_group_api_routing_groups_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RoutingGroupCreate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RoutingGroupResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/routing/groups/{group_id}": {
      "get": {
        "tags": [
          "routing-groups"
        ],
        "summary": "Get Routing Group",
        "operationId": "get_routing_group_api_routing_groups__group_id__get",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "string",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RoutingGroupDetail"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "routing-groups"
        ],
        "summary": "Update Routing Group",
        "operationId": "update_routing_group_api_routing_groups__group_id__put",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "string",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RoutingGroupUpdate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RoutingGroupResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "routing-groups"
        ],
        "summary": "Delete Routing Group",
        "operationId": "delete_routing_group_api_routing_groups__group_id__delete",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "string",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/master-data/tree": {
      "get": {
        "tags": [
          "master-data"
        ],
        "summary": "Get Master Data Tree",
        "description": "MSSQL 기준정보 트리 구조를 반환한다.",
        "operationId": "get_master_data_tree_api_master_data_tree_get",
        "parameters": [
          {
            "description": "품목 검색어",
            "required": false,
            "schema": {
              "type": "string",
              "title": "Query",
              "description": "품목 검색어"
            },
            "name": "query",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MasterDataTreeResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/master-data/items/{item_code}": {
      "get": {
        "tags": [
          "master-data"
        ],
        "summary": "Get Master Data Item",
        "description": "특정 품목의 MSSQL 행렬 데이터를 반환한다.",
        "operationId": "get_master_data_item_api_master_data_items__item_code__get",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "string",
              "title": "Item Code"
            },
            "name": "item_code",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MasterDataItemResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/master-data/logs": {
      "get": {
        "tags": [
          "master-data"
        ],
        "summary": "Get Master Data Logs",
        "description": "감사 로그 및 연결 상태를 반환한다.",
        "operationId": "get_master_data_logs_api_master_data_logs_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 50.0,
              "minimum": 1.0,
              "title": "Limit",
              "default": 5
            },
            "name": "limit",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MasterDataLogsResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/master-data/logs/download": {
      "get": {
        "tags": [
          "master-data"
        ],
        "summary": "Download Master Data Log",
        "description": "감사 로그 전체 파일을 다운로드한다.",
        "operationId": "download_master_data_log_api_master_data_logs_download_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {}
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/access/metadata": {
      "get": {
        "tags": [
          "access"
        ],
        "summary": "Fetch MSSQL Metadata",
        "operationId": "fetch_access_metadata_api_access_metadata_get",
        "parameters": [
          {
            "description": "MSSQL table name to inspect",
            "required": false,
            "schema": {
              "type": "string",
              "title": "Table",
              "description": "MSSQL table name to inspect"
            },
            "name": "table",
            "in": "query"
          },
          {
            "description": "Absolute path to the MSSQL database",
            "required": false,
            "schema": {
              "type": "string",
              "title": "Path",
              "description": "Absolute path to the MSSQL database"
            },
            "name": "path",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AccessMetadataResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups": {
      "get": {
        "tags": [
          "rsl"
        ],
        "summary": "List Groups",
        "operationId": "list_groups_api_rsl_groups_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1.0,
              "title": "Page",
              "default": 1
            },
            "name": "page",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 200.0,
              "minimum": 1.0,
              "title": "Page Size",
              "default": 20
            },
            "name": "page_size",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "items": {
                "type": "string"
              },
              "type": "array",
              "title": "Tags"
            },
            "name": "tags",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "ready",
                "pending_review",
                "released",
                "archived"
              ],
              "title": "Status"
            },
            "name": "status",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Search"
            },
            "name": "search",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupListResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Create Group",
        "operationId": "create_group_api_rsl_groups_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslGroupCreate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}": {
      "get": {
        "tags": [
          "rsl"
        ],
        "summary": "Fetch Group",
        "operationId": "fetch_group_api_rsl_groups__group_id__get",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "rsl"
        ],
        "summary": "Delete Group",
        "operationId": "delete_group_api_rsl_groups__group_id__delete",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "rsl"
        ],
        "summary": "Update Group",
        "operationId": "update_group_api_rsl_groups__group_id__patch",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslGroupUpdate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/steps": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Add Step",
        "operationId": "add_step_api_rsl_groups__group_id__steps_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslStepCreate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslStepModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/steps/{step_id}": {
      "delete": {
        "tags": [
          "rsl"
        ],
        "summary": "Delete Step",
        "operationId": "delete_step_api_rsl_groups__group_id__steps__step_id__delete",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Step Id"
            },
            "name": "step_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "rsl"
        ],
        "summary": "Update Step",
        "operationId": "update_step_api_rsl_groups__group_id__steps__step_id__patch",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Step Id"
            },
            "name": "step_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslStepUpdate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslStepModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/steps/{step_id}/rules": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Add Rule",
        "operationId": "add_rule_api_rsl_groups__group_id__steps__step_id__rules_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Step Id"
            },
            "name": "step_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslRuleRefCreate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslRuleRefModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/steps/{step_id}/rules/{rule_id}": {
      "delete": {
        "tags": [
          "rsl"
        ],
        "summary": "Delete Rule",
        "operationId": "delete_rule_api_rsl_groups__group_id__steps__step_id__rules__rule_id__delete",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Step Id"
            },
            "name": "step_id",
            "in": "path"
          },
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Rule Id"
            },
            "name": "rule_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/validate": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Validate Group",
        "operationId": "validate_group_api_rsl_groups__group_id__validate_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslValidationResponse"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/release": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Release Group",
        "operationId": "release_group_api_rsl_groups__group_id__release_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/{group_id}/retract": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Retract Group",
        "operationId": "retract_group_api_rsl_groups__group_id__retract_post",
        "parameters": [
          {
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Group Id"
            },
            "name": "group_id",
            "in": "path"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslGroupModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/export": {
      "get": {
        "tags": [
          "rsl"
        ],
        "summary": "Export Groups",
        "operationId": "export_groups_api_rsl_groups_export_get",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "json",
                "csv"
              ],
              "title": "Format",
              "default": "json"
            },
            "name": "format",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "boolean",
              "title": "Include Archived",
              "default": false
            },
            "name": "include_archived",
            "in": "query"
          },
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {}
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/rsl/groups/import": {
      "post": {
        "tags": [
          "rsl"
        ],
        "summary": "Import Groups",
        "operationId": "import_groups_api_rsl_groups_import_post",
        "parameters": [
          {
            "required": false,
            "schema": {
              "type": "string",
              "title": "Authorization"
            },
            "name": "Authorization",
            "in": "header"
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RslImportRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RslImportResult"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/audit/ui/batch": {
      "post": {
        "tags": [
          "audit"
        ],
        "summary": "Record Ui Audit Batch",
        "operationId": "record_ui_audit_batch_api_audit_ui_batch_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UiAuditBatchRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "202": {
            "description": "Accepted"
          },
          "204": {
            "description": "No Content"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "AccessConnectionRequest": {
        "properties": {
          "path": {
            "type": "string",
            "format": "path",
            "title": "Path"
          },
          "table": {
            "type": "string",
            "title": "Table"
          }
        },
        "type": "object",
        "required": [
          "path"
        ],
        "title": "AccessConnectionRequest"
      },
      "AccessConnectionResponse": {
        "properties": {
          "ok": {
            "type": "boolean",
            "title": "Ok"
          },
          "message": {
            "type": "string",
            "title": "Message"
          },
          "path_hash": {
            "type": "string",
            "title": "Path Hash"
          },
          "table_profiles": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Table Profiles"
          },
          "elapsed_ms": {
            "type": "number",
            "title": "Elapsed Ms"
          },
          "verified_table": {
            "type": "string",
            "title": "Verified Table"
          }
        },
        "type": "object",
        "required": [
          "ok",
          "message",
          "path_hash"
        ],
        "title": "AccessConnectionResponse"
      },
      "AccessMetadataColumn": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "type": {
            "type": "string",
            "title": "Type"
          },
          "nullable": {
            "type": "boolean",
            "title": "Nullable",
            "default": true
          }
        },
        "type": "object",
        "required": [
          "name",
          "type"
        ],
        "title": "AccessMetadataColumn"
      },
      "AccessMetadataResponse": {
        "properties": {
          "table": {
            "type": "string",
            "title": "Table"
          },
          "columns": {
            "items": {
              "$ref": "#/components/schemas/AccessMetadataColumn"
            },
            "type": "array",
            "title": "Columns"
          },
          "path": {
            "type": "string",
            "title": "Path"
          },
          "updated_at": {
            "type": "string",
            "title": "Updated At"
          }
        },
        "type": "object",
        "required": [
          "table",
          "columns"
        ],
        "title": "AccessMetadataResponse"
      },
      "AdminApproveRequest": {
        "properties": {
          "username": {
            "type": "string",
            "minLength": 1,
            "title": "Username"
          },
          "make_admin": {
            "type": "boolean",
            "title": "Make Admin",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "username"
        ],
        "title": "AdminApproveRequest"
      },
      "AdminRejectRequest": {
        "properties": {
          "username": {
            "type": "string",
            "minLength": 1,
            "title": "Username"
          },
          "reason": {
            "type": "string",
            "title": "Reason"
          }
        },
        "type": "object",
        "required": [
          "username"
        ],
        "title": "AdminRejectRequest"
      },
      "AuditEvent": {
        "properties": {
          "action": {
            "type": "string",
            "title": "Action"
          },
          "username": {
            "type": "string",
            "title": "Username"
          },
          "ip_address": {
            "type": "string",
            "title": "Ip Address"
          },
          "payload": {
            "type": "object",
            "title": "Payload"
          }
        },
        "type": "object",
        "required": [
          "action"
        ],
        "title": "AuditEvent"
      },
      "AuthenticatedUser": {
        "properties": {
          "username": {
            "type": "string",
            "title": "Username"
          },
          "display_name": {
            "type": "string",
            "title": "Display Name"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "approved",
              "rejected"
            ],
            "title": "Status"
          },
          "is_admin": {
            "type": "boolean",
            "title": "Is Admin",
            "default": false
          },
          "issued_at": {
            "type": "string",
            "format": "date-time",
            "title": "Issued At"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time",
            "title": "Expires At"
          },
          "session_id": {
            "type": "string",
            "title": "Session Id"
          },
          "client_host": {
            "type": "string",
            "title": "Client Host"
          }
        },
        "type": "object",
        "required": [
          "username",
          "status",
          "issued_at",
          "expires_at"
        ],
        "title": "AuthenticatedUser",
        "description": "JWT 인증을 통해 확인된 사용자."
      },
      "BlueprintToggleModel": {
        "properties": {
          "id": {
            "type": "string",
            "title": "Id"
          },
          "label": {
            "type": "string",
            "title": "Label"
          },
          "enabled": {
            "type": "boolean",
            "title": "Enabled"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "shade": {
            "type": "string",
            "title": "Shade"
          },
          "accent": {
            "type": "string",
            "title": "Accent"
          }
        },
        "type": "object",
        "required": [
          "id",
          "label",
          "enabled"
        ],
        "title": "BlueprintToggleModel"
      },
      "BlueprintTogglePatch": {
        "properties": {
          "id": {
            "type": "string",
            "title": "Id"
          },
          "enabled": {
            "type": "boolean",
            "title": "Enabled"
          },
          "description": {
            "type": "string",
            "title": "Description"
          }
        },
        "type": "object",
        "required": [
          "id"
        ],
        "title": "BlueprintTogglePatch"
      },
      "CandidateRouting": {
        "properties": {
          "CANDIDATE_ITEM_CD": {
            "type": "string",
            "title": "Candidate Item Cd"
          },
          "SIMILARITY_SCORE": {
            "type": "number",
            "title": "Similarity Score"
          },
          "ROUTING_SIGNATURE": {
            "type": "string",
            "title": "Routing Signature"
          },
          "ROUTING_SUMMARY": {
            "type": "string",
            "title": "Routing Summary"
          },
          "PRIORITY": {
            "type": "string",
            "title": "Priority"
          },
          "SIMILARITY_TIER": {
            "type": "string",
            "title": "Similarity Tier"
          },
          "HAS_ROUTING": {
            "type": "string",
            "title": "Has Routing"
          },
          "PROCESS_COUNT": {
            "type": "integer",
            "title": "Process Count"
          },
          "ITEM_CD": {
            "type": "string",
            "title": "Item Cd",
            "description": "추천이 계산된 대상 품목"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          }
        },
        "type": "object",
        "required": [
          "CANDIDATE_ITEM_CD",
          "SIMILARITY_SCORE"
        ],
        "title": "CandidateRouting"
      },
      "CandidateSaveRequest": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "candidate_id": {
            "type": "string",
            "title": "Candidate Id"
          },
          "payload": {
            "type": "object",
            "title": "Payload"
          }
        },
        "type": "object",
        "required": [
          "item_code",
          "candidate_id",
          "payload"
        ],
        "title": "CandidateSaveRequest"
      },
      "CandidateSaveResponse": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "candidate_id": {
            "type": "string",
            "title": "Candidate Id"
          },
          "saved_path": {
            "type": "string",
            "title": "Saved Path"
          },
          "saved_at": {
            "type": "string",
            "format": "date-time",
            "title": "Saved At"
          },
          "sql_preview": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Sql Preview"
          },
          "warnings": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Warnings"
          }
        },
        "type": "object",
        "required": [
          "item_code",
          "candidate_id",
          "saved_path",
          "saved_at"
        ],
        "title": "CandidateSaveResponse"
      },
      "DataSourceConfigModel": {
        "properties": {
          "offline_dataset_path": {
            "type": "string",
            "title": "MSSQL Path"
          },
          "default_table": {
            "type": "string",
            "title": "Default Table"
          },
          "backup_paths": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Backup Paths"
          },
          "table_profiles": {
            "items": {
              "$ref": "#/components/schemas/DataSourceTableProfileModel"
            },
            "type": "array",
            "title": "Table Profiles"
          },
          "column_overrides": {
            "additionalProperties": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "type": "object",
            "title": "Column Overrides"
          },
          "allow_gui_override": {
            "type": "boolean",
            "title": "Allow Gui Override",
            "default": true
          },
          "shading_palette": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Shading Palette"
          },
          "blueprint_switches": {
            "items": {
              "$ref": "#/components/schemas/BlueprintToggleModel"
            },
            "type": "array",
            "title": "Blueprint Switches"
          },
          "version_hint": {
            "type": "string",
            "title": "Version Hint"
          }
        },
        "type": "object",
        "required": [
          "offline_dataset_path",
          "default_table"
        ],
        "title": "DataSourceConfigModel"
      },
      "DataSourceConfigPatch": {
        "properties": {
          "offline_dataset_path": {
            "type": "string",
            "title": "MSSQL Path"
          },
          "default_table": {
            "type": "string",
            "title": "Default Table"
          },
          "backup_paths": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Backup Paths"
          },
          "table_profiles": {
            "items": {
              "$ref": "#/components/schemas/DataSourceTableProfileModel"
            },
            "type": "array",
            "title": "Table Profiles"
          },
          "column_overrides": {
            "additionalProperties": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "type": "object",
            "title": "Column Overrides"
          },
          "allow_gui_override": {
            "type": "boolean",
            "title": "Allow Gui Override"
          },
          "blueprint_switches": {
            "items": {
              "$ref": "#/components/schemas/BlueprintTogglePatch"
            },
            "type": "array",
            "title": "Blueprint Switches"
          }
        },
        "type": "object",
        "title": "DataSourceConfigPatch"
      },
      "DataSourceTableProfileModel": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "label": {
            "type": "string",
            "title": "Label"
          },
          "role": {
            "type": "string",
            "enum": [
              "features",
              "routing",
              "results",
              "aux"
            ],
            "title": "Role",
            "default": "features"
          },
          "required": {
            "type": "boolean",
            "title": "Required",
            "default": false
          },
          "columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Columns"
          },
          "description": {
            "type": "string",
            "title": "Description"
          }
        },
        "type": "object",
        "required": [
          "name",
          "label"
        ],
        "title": "DataSourceTableProfileModel"
      },
      "ExportConfigModel": {
        "properties": {
          "enable_cache_save": {
            "type": "boolean",
            "title": "Enable Cache Save",
            "default": false
          },
          "enable_excel": {
            "type": "boolean",
            "title": "Enable Excel",
            "default": true
          },
          "enable_csv": {
            "type": "boolean",
            "title": "Enable Csv",
            "default": true
          },
          "enable_txt": {
            "type": "boolean",
            "title": "Enable Txt",
            "default": true
          },
          "enable_parquet": {
            "type": "boolean",
            "title": "Enable Parquet",
            "default": true
          },
          "enable_json": {
            "type": "boolean",
            "title": "Enable Json",
            "default": true
          },
          "erp_interface_enabled": {
            "type": "boolean",
            "title": "Erp Interface Enabled",
            "default": false
          },
          "erp_protocol": {
            "type": "string",
            "title": "Erp Protocol"
          },
          "erp_endpoint": {
            "type": "string",
            "title": "Erp Endpoint"
          },
          "default_encoding": {
            "type": "string",
            "title": "Default Encoding",
            "default": "utf-8"
          },
          "export_directory": {
            "type": "string",
            "title": "Export Directory"
          },
          "compress_on_save": {
            "type": "boolean",
            "title": "Compress On Save",
            "default": true
          }
        },
        "type": "object",
        "required": [
          "export_directory"
        ],
        "title": "ExportConfigModel"
      },
      "ExportConfigPatch": {
        "properties": {
          "enable_cache_save": {
            "type": "boolean",
            "title": "Enable Cache Save"
          },
          "enable_excel": {
            "type": "boolean",
            "title": "Enable Excel"
          },
          "enable_csv": {
            "type": "boolean",
            "title": "Enable Csv"
          },
          "enable_txt": {
            "type": "boolean",
            "title": "Enable Txt"
          },
          "enable_parquet": {
            "type": "boolean",
            "title": "Enable Parquet"
          },
          "enable_json": {
            "type": "boolean",
            "title": "Enable Json"
          },
          "erp_interface_enabled": {
            "type": "boolean",
            "title": "Erp Interface Enabled"
          },
          "erp_protocol": {
            "type": "string",
            "title": "Erp Protocol"
          },
          "erp_endpoint": {
            "type": "string",
            "title": "Erp Endpoint"
          },
          "default_encoding": {
            "type": "string",
            "title": "Default Encoding"
          },
          "export_directory": {
            "type": "string",
            "title": "Export Directory"
          },
          "compress_on_save": {
            "type": "boolean",
            "title": "Compress On Save"
          }
        },
        "type": "object",
        "title": "ExportConfigPatch"
      },
      "GroupRecommendation": {
        "properties": {
          "group_id": {
            "type": "string",
            "title": "Group Id",
            "description": "그룹 식별자"
          },
          "score": {
            "type": "number",
            "minimum": 0.0,
            "title": "Score",
            "description": "우선 순위/점수"
          },
          "source": {
            "type": "string",
            "enum": [
              "manifest",
              "prediction",
              "inference"
            ],
            "title": "Source",
            "description": "추천 근거"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          }
        },
        "type": "object",
        "required": [
          "group_id",
          "score",
          "source"
        ],
        "title": "GroupRecommendation"
      },
      "GroupRecommendationRequest": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code",
            "description": "추천을 요청할 품목 코드"
          },
          "candidate_limit": {
            "type": "integer",
            "maximum": 20.0,
            "minimum": 1.0,
            "title": "Candidate Limit",
            "description": "반환할 최대 추천 개수",
            "default": 5
          },
          "similarity_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity Threshold",
            "description": "관련 유사 품목 필터링 기준"
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "GroupRecommendationRequest"
      },
      "GroupRecommendationResponse": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "recommendations": {
            "items": {
              "$ref": "#/components/schemas/GroupRecommendation"
            },
            "type": "array",
            "title": "Recommendations"
          },
          "inspected_candidates": {
            "type": "integer",
            "title": "Inspected Candidates",
            "description": "추천 산출 시 참고한 후보 품목 수",
            "default": 0
          },
          "manifest_revision": {
            "type": "string",
            "title": "Manifest Revision"
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "GroupRecommendationResponse"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "HealthResponse": {
        "properties": {
          "status": {
            "type": "string",
            "title": "Status"
          },
          "detail": {
            "type": "string",
            "title": "Detail"
          }
        },
        "type": "object",
        "required": [
          "status"
        ],
        "title": "HealthResponse"
      },
      "LoginRequest": {
        "properties": {
          "username": {
            "type": "string",
            "minLength": 1,
            "title": "Username",
            "description": "로그인 ID"
          },
          "password": {
            "type": "string",
            "minLength": 1,
            "title": "Password",
            "description": "비밀번호"
          }
        },
        "type": "object",
        "required": [
          "username",
          "password"
        ],
        "title": "LoginRequest",
        "description": "로그인 요청 페이로드."
      },
      "LoginResponse": {
        "properties": {
          "username": {
            "type": "string",
            "title": "Username"
          },
          "display_name": {
            "type": "string",
            "title": "Display Name"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "approved",
              "rejected"
            ],
            "title": "Status"
          },
          "is_admin": {
            "type": "boolean",
            "title": "Is Admin",
            "default": false
          },
          "token": {
            "type": "string",
            "title": "Token"
          },
          "issued_at": {
            "type": "string",
            "format": "date-time",
            "title": "Issued At"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time",
            "title": "Expires At"
          }
        },
        "type": "object",
        "required": [
          "username",
          "status",
          "token",
          "issued_at",
          "expires_at"
        ],
        "title": "LoginResponse",
        "description": "로그인 응답."
      },
      "MasterDataConnectionStatus": {
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "connected",
              "disconnected"
            ],
            "title": "Status"
          },
          "path": {
            "type": "string",
            "title": "Path"
          },
          "last_sync": {
            "type": "string",
            "title": "Last Sync"
          }
        },
        "type": "object",
        "required": [
          "status",
          "path"
        ],
        "title": "MasterDataConnectionStatus"
      },
      "MasterDataItemResponse": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "columns": {
            "items": {
              "$ref": "#/components/schemas/MasterDataMatrixColumn"
            },
            "type": "array",
            "title": "Columns"
          },
          "rows": {
            "items": {
              "$ref": "#/components/schemas/MasterDataMatrixRow"
            },
            "type": "array",
            "title": "Rows"
          },
          "record_count": {
            "type": "integer",
            "title": "Record Count"
          }
        },
        "type": "object",
        "required": [
          "item_code",
          "columns",
          "rows",
          "record_count"
        ],
        "title": "MasterDataItemResponse"
      },
      "MasterDataLogEntry": {
        "properties": {
          "timestamp": {
            "type": "string",
            "title": "Timestamp"
          },
          "ip": {
            "type": "string",
            "title": "Ip"
          },
          "user": {
            "type": "string",
            "title": "User"
          },
          "action": {
            "type": "string",
            "title": "Action"
          },
          "target": {
            "type": "string",
            "title": "Target"
          }
        },
        "type": "object",
        "required": [
          "timestamp",
          "ip",
          "user",
          "action",
          "target"
        ],
        "title": "MasterDataLogEntry"
      },
      "MasterDataLogsResponse": {
        "properties": {
          "logs": {
            "items": {
              "$ref": "#/components/schemas/MasterDataLogEntry"
            },
            "type": "array",
            "title": "Logs"
          },
          "connection": {
            "$ref": "#/components/schemas/MasterDataConnectionStatus"
          }
        },
        "type": "object",
        "required": [
          "logs",
          "connection"
        ],
        "title": "MasterDataLogsResponse"
      },
      "MasterDataMatrixColumn": {
        "properties": {
          "key": {
            "type": "string",
            "title": "Key"
          },
          "label": {
            "type": "string",
            "title": "Label"
          },
          "width": {
            "type": "string",
            "title": "Width"
          }
        },
        "type": "object",
        "required": [
          "key",
          "label"
        ],
        "title": "MasterDataMatrixColumn"
      },
      "MasterDataMatrixRow": {
        "properties": {
          "key": {
            "type": "string",
            "title": "Key"
          },
          "values": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Values"
          }
        },
        "type": "object",
        "required": [
          "key",
          "values"
        ],
        "title": "MasterDataMatrixRow"
      },
      "MasterDataTreeNode": {
        "properties": {
          "id": {
            "type": "string",
            "title": "Id"
          },
          "label": {
            "type": "string",
            "title": "Label"
          },
          "type": {
            "type": "string",
            "enum": [
              "group",
              "family",
              "item"
            ],
            "title": "Type"
          },
          "children": {
            "items": {
              "$ref": "#/components/schemas/MasterDataTreeNode"
            },
            "type": "array",
            "title": "Children"
          },
          "meta": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Meta"
          }
        },
        "type": "object",
        "required": [
          "id",
          "label",
          "type"
        ],
        "title": "MasterDataTreeNode"
      },
      "MasterDataTreeResponse": {
        "properties": {
          "nodes": {
            "items": {
              "$ref": "#/components/schemas/MasterDataTreeNode"
            },
            "type": "array",
            "title": "Nodes"
          },
          "total_items": {
            "type": "integer",
            "title": "Total Items"
          },
          "filtered_items": {
            "type": "integer",
            "title": "Filtered Items"
          },
          "default_item_code": {
            "type": "string",
            "title": "Default Item Code"
          }
        },
        "type": "object",
        "required": [
          "nodes",
          "total_items",
          "filtered_items"
        ],
        "title": "MasterDataTreeResponse"
      },
      "ModelVersionModel": {
        "properties": {
          "version_name": {
            "type": "string",
            "title": "Version Name"
          },
          "artifact_dir": {
            "type": "string",
            "title": "Artifact Dir"
          },
          "manifest_path": {
            "type": "string",
            "title": "Manifest Path"
          },
          "status": {
            "type": "string",
            "title": "Status"
          },
          "active_flag": {
            "type": "boolean",
            "title": "Active Flag"
          },
          "requested_by": {
            "type": "string",
            "title": "Requested By"
          },
          "created_at": {
            "type": "string",
            "title": "Created At"
          },
          "trained_at": {
            "type": "string",
            "title": "Trained At"
          },
          "activated_at": {
            "type": "string",
            "title": "Activated At"
          },
          "updated_at": {
            "type": "string",
            "title": "Updated At"
          }
        },
        "type": "object",
        "required": [
          "version_name",
          "artifact_dir",
          "manifest_path",
          "status",
          "active_flag",
          "created_at"
        ],
        "title": "ModelVersionModel"
      },
      "OperationStep": {
        "properties": {
          "PROC_SEQ": {
            "type": "integer",
            "title": "Proc Seq"
          },
          "INSIDE_FLAG": {
            "type": "string",
            "title": "Inside Flag"
          },
          "dbo_BI_ROUTING_VIEW_JOB_CD": {
            "type": "string",
            "title": "Dbo Bi Routing View Job Cd"
          },
          "JOB_NM": {
            "type": "string",
            "title": "Job Nm"
          },
          "RES_CD": {
            "type": "string",
            "title": "Res Cd"
          },
          "RES_DIS": {
            "type": "string",
            "title": "Res Dis"
          },
          "TIME_UNIT": {
            "type": "string",
            "title": "Time Unit"
          },
          "MFG_LT": {
            "type": "number",
            "title": "Mfg Lt"
          },
          "QUEUE_TIME": {
            "type": "number",
            "title": "Queue Time"
          },
          "SETUP_TIME": {
            "type": "number",
            "title": "Setup Time"
          },
          "MACH_WORKED_HOURS": {
            "type": "number",
            "title": "Mach Worked Hours"
          },
          "ACT_SETUP_TIME": {
            "type": "number",
            "title": "Act Setup Time"
          },
          "ACT_RUN_TIME": {
            "type": "number",
            "title": "Act Run Time"
          },
          "WAIT_TIME": {
            "type": "number",
            "title": "Wait Time"
          },
          "MOVE_TIME": {
            "type": "number",
            "title": "Move Time"
          },
          "RUN_TIME_QTY": {
            "type": "number",
            "title": "Run Time Qty"
          },
          "RUN_TIME_UNIT": {
            "type": "string",
            "title": "Run Time Unit"
          },
          "BATCH_OPER": {
            "type": "string",
            "title": "Batch Oper"
          },
          "BP_CD": {
            "type": "string",
            "title": "Bp Cd"
          },
          "dbo_BI_ROUTING_VIEW_CUST_NM": {
            "type": "string",
            "title": "Dbo Bi Routing View Cust Nm"
          },
          "CUR_CD": {
            "type": "string",
            "title": "Cur Cd"
          },
          "SUBCONTRACT_PRC": {
            "type": "number",
            "title": "Subcontract Prc"
          },
          "TAX_TYPE": {
            "type": "string",
            "title": "Tax Type"
          },
          "MILESTONE_FLG": {
            "type": "string",
            "title": "Milestone Flg"
          },
          "INSP_FLG": {
            "type": "string",
            "title": "Insp Flg"
          },
          "ROUT_ORDER": {
            "type": "string",
            "title": "Rout Order"
          },
          "VALID_FROM_DT": {
            "type": "string",
            "title": "Valid From Dt"
          },
          "VALID_TO_DT": {
            "type": "string",
            "title": "Valid To Dt"
          },
          "dbo_BI_ROUTING_VIEW_REMARK": {
            "type": "string",
            "title": "Dbo Bi Routing View Remark"
          },
          "ROUT_DOC": {
            "type": "string",
            "title": "Rout Doc"
          },
          "DOC_INSIDE": {
            "type": "string",
            "title": "Doc Inside"
          },
          "DOC_NO": {
            "type": "string",
            "title": "Doc No"
          },
          "NC_PROGRAM": {
            "type": "string",
            "title": "Nc Program"
          },
          "NC_PROGRAM_WRITER": {
            "type": "string",
            "title": "Nc Program Writer"
          },
          "NC_WRITER_NM": {
            "type": "string",
            "title": "Nc Writer Nm"
          },
          "NC_WRITE_DATE": {
            "type": "string",
            "title": "Nc Write Date"
          },
          "NC_REVIEWER": {
            "type": "string",
            "title": "Nc Reviewer"
          },
          "NC_REVIEWER_NM": {
            "type": "string",
            "title": "Nc Reviewer Nm"
          },
          "NC_REVIEW_DT": {
            "type": "string",
            "title": "Nc Review Dt"
          },
          "RAW_MATL_SIZE": {
            "type": "string",
            "title": "Raw Matl Size"
          },
          "JAW_SIZE": {
            "type": "string",
            "title": "Jaw Size"
          },
          "VALIDITY": {
            "type": "string",
            "title": "Validity"
          },
          "PROGRAM_REMARK": {
            "type": "string",
            "title": "Program Remark"
          },
          "OP_DRAW_NO": {
            "type": "string",
            "title": "Op Draw No"
          },
          "MTMG_NUMB": {
            "type": "string",
            "title": "Mtmg Numb"
          }
        },
        "type": "object",
        "required": [
          "PROC_SEQ"
        ],
        "title": "OperationStep"
      },
      "PaginationMeta": {
        "properties": {
          "limit": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Limit",
            "description": "페이지 크기"
          },
          "offset": {
            "type": "integer",
            "minimum": 0.0,
            "title": "Offset",
            "description": "페이지 시작 위치"
          },
          "total": {
            "type": "integer",
            "minimum": 0.0,
            "title": "Total",
            "description": "총 레코드 수"
          }
        },
        "type": "object",
        "required": [
          "limit",
          "offset",
          "total"
        ],
        "title": "PaginationMeta",
        "description": "Metadata describing pagination state."
      },
      "PowerQueryProfileModel": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "mapping": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Mapping"
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "PowerQueryProfileModel"
      },
      "PredictionRequest": {
        "properties": {
          "item_codes": {
            "items": {
              "type": "string",
              "minLength": 1
            },
            "type": "array",
            "minLength": 1,
            "title": "Item Codes",
            "description": "List of item codes to run predictions for"
          },
          "top_k": {
            "type": "integer",
            "maximum": 50.0,
            "minimum": 1.0,
            "title": "Top K",
            "description": "Maximum number of routing candidates"
          },
          "similarity_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity Threshold",
            "description": "Minimum similarity score to keep a candidate"
          },
          "mode": {
            "type": "string",
            "title": "Mode",
            "description": "Response aggregation mode (summary|detailed)",
            "default": "summary"
          },
          "feature_weights": {
            "additionalProperties": {
              "type": "number"
            },
            "type": "object",
            "title": "Feature Weights",
            "description": "Explicit feature weight overrides keyed by master-data column"
          },
          "weight_profile": {
            "type": "string",
            "title": "Weight Profile",
            "description": "Identifier of a predefined weight profile"
          },
          "export_formats": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Export Formats",
            "description": "Optional export formats to generate immediately (csv|excel|txt|json|parquet)"
          },
          "with_visualization": {
            "type": "boolean",
            "title": "With Visualization",
            "description": "Whether to include visualization artifacts (TensorBoard, Neo4j)",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "item_codes"
        ],
        "title": "PredictionRequest",
        "description": "Payload for routing prediction requests."
      },
      "PredictionResponse": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/RoutingSummary"
            },
            "type": "array",
            "title": "Items"
          },
          "candidates": {
            "items": {
              "$ref": "#/components/schemas/CandidateRouting"
            },
            "type": "array",
            "title": "Candidates"
          },
          "metrics": {
            "type": "object",
            "title": "Metrics"
          }
        },
        "type": "object",
        "required": [
          "items",
          "candidates"
        ],
        "title": "PredictionResponse",
        "description": "?덉륫 ?묐떟."
      },
      "PredictorRuntimeModel": {
        "properties": {
          "similarity_high_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity High Threshold"
          },
          "max_routing_variants": {
            "type": "integer",
            "maximum": 10.0,
            "minimum": 1.0,
            "title": "Max Routing Variants"
          },
          "trim_std_enabled": {
            "type": "boolean",
            "title": "Trim Std Enabled",
            "default": true
          },
          "trim_lower_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Lower Percent",
            "default": 0.05
          },
          "trim_upper_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Upper Percent",
            "default": 0.95
          }
        },
        "type": "object",
        "required": [
          "similarity_high_threshold",
          "max_routing_variants"
        ],
        "title": "PredictorRuntimeModel"
      },
      "PredictorRuntimePatch": {
        "properties": {
          "similarity_high_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity High Threshold"
          },
          "max_routing_variants": {
            "type": "integer",
            "maximum": 10.0,
            "minimum": 1.0,
            "title": "Max Routing Variants"
          },
          "trim_std_enabled": {
            "type": "boolean",
            "title": "Trim Std Enabled"
          },
          "trim_lower_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Lower Percent"
          },
          "trim_upper_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Upper Percent"
          }
        },
        "type": "object",
        "title": "PredictorRuntimePatch"
      },
      "RegisterRequest": {
        "properties": {
          "username": {
            "type": "string",
            "minLength": 1,
            "title": "Username",
            "description": "로그인 ID"
          },
          "password": {
            "type": "string",
            "minLength": 1,
            "title": "Password",
            "description": "비밀번호"
          },
          "display_name": {
            "type": "string",
            "title": "Display Name",
            "description": "사용자에게 표시할 이름"
          }
        },
        "type": "object",
        "required": [
          "username",
          "password"
        ],
        "title": "RegisterRequest",
        "description": "신규 사용자 등록 요청."
      },
      "RegisterResponse": {
        "properties": {
          "username": {
            "type": "string",
            "title": "Username"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "approved",
              "rejected"
            ],
            "title": "Status"
          },
          "is_admin": {
            "type": "boolean",
            "title": "Is Admin",
            "default": false
          },
          "message": {
            "type": "string",
            "title": "Message"
          }
        },
        "type": "object",
        "required": [
          "username",
          "status",
          "message"
        ],
        "title": "RegisterResponse",
        "description": "가입 요청 결과."
      },
      "RoutingGroupCreate": {
        "properties": {
          "group_name": {
            "type": "string",
            "maxLength": 64,
            "minLength": 2,
            "title": "Group Name",
            "description": "사용자 정의 그룹명"
          },
          "item_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "minItems": 1,
            "title": "Item Codes",
            "description": "라우팅 대상 품목 코드 목록"
          },
          "steps": {
            "items": {
              "$ref": "#/components/schemas/RoutingStep"
            },
            "type": "array",
            "title": "Steps",
            "description": "라우팅 공정 단계 목록"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부",
            "default": false
          },
          "metadata": {
            "type": "object",
            "title": "Metadata",
            "description": "추가 메타데이터"
          }
        },
        "type": "object",
        "required": [
          "group_name",
          "item_codes"
        ],
        "title": "RoutingGroupCreate",
        "description": "Payload for creating a routing group."
      },
      "RoutingGroupDetail": {
        "properties": {
          "group_id": {
            "type": "string",
            "title": "Group Id",
            "description": "라우팅 그룹 식별자(UUID)"
          },
          "group_name": {
            "type": "string",
            "title": "Group Name",
            "description": "그룹명"
          },
          "owner": {
            "type": "string",
            "title": "Owner",
            "description": "그룹 소유자"
          },
          "version": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Version",
            "description": "현재 버전"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At",
            "description": "최종 수정 시각"
          },
          "item_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Item Codes",
            "description": "품목 코드 목록"
          },
          "steps": {
            "items": {
              "$ref": "#/components/schemas/RoutingStep"
            },
            "type": "array",
            "title": "Steps",
            "description": "라우팅 공정 단계 목록"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata",
            "description": "추가 메타데이터"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "title": "Created At",
            "description": "생성 시각"
          },
          "deleted_at": {
            "type": "string",
            "format": "date-time",
            "title": "Deleted At",
            "description": "삭제 시각 (소프트 삭제)"
          }
        },
        "type": "object",
        "required": [
          "group_id",
          "group_name",
          "owner",
          "version",
          "updated_at",
          "item_codes",
          "steps",
          "erp_required",
          "created_at"
        ],
        "title": "RoutingGroupDetail",
        "description": "Detailed representation of a routing group."
      },
      "RoutingGroupListResponse": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/RoutingGroupSummary"
            },
            "type": "array",
            "title": "Items",
            "description": "라우팅 그룹 목록"
          },
          "pagination": {
            "allOf": [
              {
                "$ref": "#/components/schemas/PaginationMeta"
              }
            ],
            "title": "Pagination",
            "description": "페이징 정보"
          }
        },
        "type": "object",
        "required": [
          "items",
          "pagination"
        ],
        "title": "RoutingGroupListResponse",
        "description": "Response model for routing group collections."
      },
      "RoutingGroupResponse": {
        "properties": {
          "group_id": {
            "type": "string",
            "title": "Group Id",
            "description": "라우팅 그룹 식별자(UUID)"
          },
          "group_name": {
            "type": "string",
            "title": "Group Name",
            "description": "그룹명"
          },
          "owner": {
            "type": "string",
            "title": "Owner",
            "description": "그룹 소유자"
          },
          "version": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Version",
            "description": "현재 버전"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At",
            "description": "최종 수정 시각"
          }
        },
        "type": "object",
        "required": [
          "group_id",
          "group_name",
          "owner",
          "version",
          "updated_at"
        ],
        "title": "RoutingGroupResponse",
        "description": "Summary information returned after create/update operations."
      },
      "RoutingGroupSummary": {
        "properties": {
          "group_id": {
            "type": "string",
            "title": "Group Id",
            "description": "라우팅 그룹 식별자"
          },
          "group_name": {
            "type": "string",
            "title": "Group Name",
            "description": "그룹명"
          },
          "item_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Item Codes",
            "description": "품목 코드 목록"
          },
          "step_count": {
            "type": "integer",
            "minimum": 0.0,
            "title": "Step Count",
            "description": "공정 단계 수"
          },
          "version": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Version",
            "description": "현재 버전"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At",
            "description": "최종 수정 시각"
          }
        },
        "type": "object",
        "required": [
          "group_id",
          "group_name",
          "item_codes",
          "step_count",
          "version",
          "updated_at"
        ],
        "title": "RoutingGroupSummary",
        "description": "Item returned in list responses."
      },
      "RoutingGroupUpdate": {
        "properties": {
          "group_name": {
            "type": "string",
            "maxLength": 64,
            "minLength": 2,
            "title": "Group Name",
            "description": "새 그룹명"
          },
          "item_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "minItems": 1,
            "title": "Item Codes",
            "description": "새 품목 코드 목록"
          },
          "steps": {
            "items": {
              "$ref": "#/components/schemas/RoutingStep"
            },
            "type": "array",
            "title": "Steps",
            "description": "새 라우팅 공정 단계 목록"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata",
            "description": "추가 메타데이터"
          },
          "version": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Version",
            "description": "현재 저장된 그룹 버전(낙관적 잠금)"
          }
        },
        "type": "object",
        "required": [
          "version"
        ],
        "title": "RoutingGroupUpdate",
        "description": "Payload for updating an existing routing group."
      },
      "RoutingStep": {
        "properties": {
          "seq": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Seq",
            "description": "1부터 시작하는 실행 순서"
          },
          "process_code": {
            "type": "string",
            "maxLength": 128,
            "minLength": 1,
            "title": "Process Code",
            "description": "공정 코드"
          },
          "duration_min": {
            "type": "number",
            "minimum": 0.0,
            "title": "Duration Min",
            "description": "예상 가공 시간(분)"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata",
            "description": "추가 파라미터(JSON)"
          }
        },
        "type": "object",
        "required": [
          "seq",
          "process_code"
        ],
        "title": "RoutingStep",
        "description": "Represents an individual routing step within a group."
      },
      "RoutingSummary": {
        "properties": {
          "ITEM_CD": {
            "type": "string",
            "title": "Item Cd"
          },
          "CANDIDATE_ID": {
            "type": "string",
            "title": "Candidate Id"
          },
          "ROUTING_SIGNATURE": {
            "type": "string",
            "title": "Routing Signature"
          },
          "PRIORITY": {
            "type": "string",
            "title": "Priority"
          },
          "SIMILARITY_TIER": {
            "type": "string",
            "title": "Similarity Tier"
          },
          "SIMILARITY_SCORE": {
            "type": "number",
            "title": "Similarity Score"
          },
          "REFERENCE_ITEM_CD": {
            "type": "string",
            "title": "Reference Item Cd"
          },
          "generated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Generated At"
          },
          "operations": {
            "items": {
              "$ref": "#/components/schemas/OperationStep"
            },
            "type": "array",
            "title": "Operations"
          }
        },
        "type": "object",
        "required": [
          "ITEM_CD"
        ],
        "title": "RoutingSummary"
      },
      "RslGroupCreate": {
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "slug": {
            "type": "string",
            "maxLength": 64,
            "minLength": 1,
            "title": "Slug"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "RslGroupCreate"
      },
      "RslGroupListResponse": {
        "properties": {
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "page": {
            "type": "integer",
            "title": "Page"
          },
          "page_size": {
            "type": "integer",
            "title": "Page Size"
          },
          "items": {
            "items": {
              "$ref": "#/components/schemas/RslGroupModel"
            },
            "type": "array",
            "title": "Items"
          }
        },
        "type": "object",
        "required": [
          "total",
          "page",
          "page_size",
          "items"
        ],
        "title": "RslGroupListResponse"
      },
      "RslGroupModel": {
        "properties": {
          "id": {
            "type": "integer",
            "title": "Id"
          },
          "slug": {
            "type": "string",
            "title": "Slug"
          },
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "owner": {
            "type": "string",
            "title": "Owner"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부",
            "default": false
          },
          "status": {
            "type": "string",
            "enum": [
              "draft",
              "ready",
              "pending_review",
              "released",
              "archived"
            ],
            "title": "Status"
          },
          "validation_errors": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Validation Errors"
          },
          "last_validated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Last Validated At"
          },
          "released_at": {
            "type": "string",
            "format": "date-time",
            "title": "Released At"
          },
          "released_by": {
            "type": "string",
            "title": "Released By"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "title": "Created At"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At"
          },
          "steps": {
            "items": {
              "$ref": "#/components/schemas/RslStepModel"
            },
            "type": "array",
            "title": "Steps"
          }
        },
        "type": "object",
        "required": [
          "id",
          "slug",
          "name",
          "owner",
          "status",
          "created_at",
          "updated_at"
        ],
        "title": "RslGroupModel"
      },
      "RslGroupUpdate": {
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "slug": {
            "type": "string",
            "maxLength": 64,
            "minLength": 1,
            "title": "Slug"
          },
          "erp_required": {
            "type": "boolean",
            "title": "Erp Required",
            "description": "ERP 인터페이스 필요 여부"
          }
        },
        "type": "object",
        "title": "RslGroupUpdate"
      },
      "RslImportRequest": {
        "properties": {
          "format": {
            "type": "string",
            "enum": [
              "json",
              "csv"
            ],
            "title": "Format"
          },
          "payload": {
            "type": "string",
            "title": "Payload"
          }
        },
        "type": "object",
        "required": [
          "format",
          "payload"
        ],
        "title": "RslImportRequest"
      },
      "RslImportResult": {
        "properties": {
          "created": {
            "type": "integer",
            "title": "Created",
            "default": 0
          },
          "updated": {
            "type": "integer",
            "title": "Updated",
            "default": 0
          },
          "skipped": {
            "type": "integer",
            "title": "Skipped",
            "default": 0
          },
          "errors": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Errors"
          }
        },
        "type": "object",
        "title": "RslImportResult"
      },
      "RslRuleRefCreate": {
        "properties": {
          "rule_name": {
            "type": "string",
            "minLength": 1,
            "title": "Rule Name"
          },
          "rule_version": {
            "type": "string",
            "maxLength": 64,
            "title": "Rule Version"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          },
          "is_optional": {
            "type": "boolean",
            "title": "Is Optional",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "rule_name"
        ],
        "title": "RslRuleRefCreate"
      },
      "RslRuleRefModel": {
        "properties": {
          "id": {
            "type": "integer",
            "title": "Id"
          },
          "rule_name": {
            "type": "string",
            "title": "Rule Name"
          },
          "rule_version": {
            "type": "string",
            "title": "Rule Version"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          },
          "is_optional": {
            "type": "boolean",
            "title": "Is Optional",
            "default": false
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "title": "Created At"
          }
        },
        "type": "object",
        "required": [
          "id",
          "rule_name",
          "created_at"
        ],
        "title": "RslRuleRefModel"
      },
      "RslStepCreate": {
        "properties": {
          "sequence": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Sequence"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "status": {
            "type": "string",
            "enum": [
              "draft",
              "ready",
              "released"
            ],
            "title": "Status"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "config": {
            "type": "object",
            "title": "Config"
          },
          "rules": {
            "items": {
              "$ref": "#/components/schemas/RslRuleRefCreate"
            },
            "type": "array",
            "title": "Rules"
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "RslStepCreate"
      },
      "RslStepModel": {
        "properties": {
          "id": {
            "type": "integer",
            "title": "Id"
          },
          "sequence": {
            "type": "integer",
            "title": "Sequence"
          },
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "status": {
            "type": "string",
            "enum": [
              "draft",
              "ready",
              "released"
            ],
            "title": "Status"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "config": {
            "type": "object",
            "title": "Config"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "title": "Created At"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At"
          },
          "rules": {
            "items": {
              "$ref": "#/components/schemas/RslRuleRefModel"
            },
            "type": "array",
            "title": "Rules"
          }
        },
        "type": "object",
        "required": [
          "id",
          "sequence",
          "name",
          "status",
          "created_at",
          "updated_at"
        ],
        "title": "RslStepModel"
      },
      "RslStepUpdate": {
        "properties": {
          "sequence": {
            "type": "integer",
            "minimum": 1.0,
            "title": "Sequence"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "status": {
            "type": "string",
            "enum": [
              "draft",
              "ready",
              "released"
            ],
            "title": "Status"
          },
          "tags": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Tags"
          },
          "config": {
            "type": "object",
            "title": "Config"
          }
        },
        "type": "object",
        "title": "RslStepUpdate"
      },
      "RslValidationResponse": {
        "properties": {
          "group_id": {
            "type": "integer",
            "title": "Group Id"
          },
          "is_valid": {
            "type": "boolean",
            "title": "Is Valid"
          },
          "errors": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Errors"
          },
          "validated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Validated At"
          }
        },
        "type": "object",
        "required": [
          "group_id",
          "is_valid",
          "errors",
          "validated_at"
        ],
        "title": "RslValidationResponse"
      },
      "RuleValidationRequest": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "operations": {
            "items": {
              "$ref": "#/components/schemas/OperationStep"
            },
            "type": "array",
            "title": "Operations"
          },
          "rule_ids": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Rule Ids",
            "description": "검증할 규칙 ID 목록 (None이면 전체)"
          },
          "context": {
            "type": "object",
            "title": "Context",
            "description": "검증 시 참고할 추가 컨텍스트"
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "RuleValidationRequest"
      },
      "RuleValidationResponse": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "passed": {
            "type": "boolean",
            "title": "Passed"
          },
          "violations": {
            "items": {
              "$ref": "#/components/schemas/RuleViolation"
            },
            "type": "array",
            "title": "Violations"
          },
          "evaluated_rules": {
            "type": "integer",
            "minimum": 0.0,
            "title": "Evaluated Rules",
            "default": 0
          }
        },
        "type": "object",
        "required": [
          "item_code",
          "passed"
        ],
        "title": "RuleValidationResponse"
      },
      "RuleViolation": {
        "properties": {
          "rule_id": {
            "type": "string",
            "title": "Rule Id"
          },
          "message": {
            "type": "string",
            "title": "Message"
          },
          "severity": {
            "type": "string",
            "enum": [
              "info",
              "warning",
              "error"
            ],
            "title": "Severity",
            "default": "error"
          }
        },
        "type": "object",
        "required": [
          "rule_id",
          "message"
        ],
        "title": "RuleViolation"
      },
      "SQLConfigModel": {
        "properties": {
          "output_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Output Columns"
          },
          "column_aliases": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Column Aliases"
          },
          "available_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Available Columns"
          },
          "profiles": {
            "items": {
              "$ref": "#/components/schemas/PowerQueryProfileModel"
            },
            "type": "array",
            "title": "Profiles"
          },
          "active_profile": {
            "type": "string",
            "title": "Active Profile"
          },
          "exclusive_column_groups": {
            "items": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "type": "array",
            "title": "Exclusive Column Groups"
          },
          "key_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Key Columns"
          },
          "training_output_mapping": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Training Output Mapping"
          }
        },
        "type": "object",
        "title": "SQLConfigModel"
      },
      "SQLConfigPatch": {
        "properties": {
          "output_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Output Columns"
          },
          "column_aliases": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Column Aliases"
          },
          "available_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Available Columns"
          },
          "profiles": {
            "items": {
              "$ref": "#/components/schemas/PowerQueryProfileModel"
            },
            "type": "array",
            "title": "Profiles"
          },
          "active_profile": {
            "type": "string",
            "title": "Active Profile"
          },
          "exclusive_column_groups": {
            "items": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "type": "array",
            "title": "Exclusive Column Groups"
          },
          "key_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Key Columns"
          },
          "training_output_mapping": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object",
            "title": "Training Output Mapping"
          }
        },
        "type": "object",
        "title": "SQLConfigPatch"
      },
      "SimilarItem": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code",
            "description": "유사 품목 코드"
          },
          "similarity_score": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity Score",
            "description": "유사도 점수"
          },
          "source": {
            "type": "string",
            "enum": [
              "prediction",
              "manifest"
            ],
            "title": "Source",
            "description": "유사도 정보 출처",
            "default": "prediction"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata",
            "description": "매니페스트에서 제공되는 부가 메타데이터"
          }
        },
        "type": "object",
        "required": [
          "item_code",
          "similarity_score"
        ],
        "title": "SimilarItem"
      },
      "SimilaritySearchRequest": {
        "properties": {
          "item_codes": {
            "items": {
              "type": "string",
              "minLength": 1
            },
            "type": "array",
            "minLength": 1,
            "title": "Item Codes",
            "description": "유사 후보를 조회할 품목 코드 목록"
          },
          "top_k": {
            "type": "integer",
            "maximum": 50.0,
            "minimum": 1.0,
            "title": "Top K",
            "description": "후보로 반환할 최대 품목 수"
          },
          "min_similarity": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Min Similarity",
            "description": "후보 필터링에 사용할 최소 유사도"
          },
          "feature_weights": {
            "additionalProperties": {
              "type": "number"
            },
            "type": "object",
            "title": "Feature Weights",
            "description": "예측 시 적용할 수동 가중치"
          },
          "weight_profile": {
            "type": "string",
            "title": "Weight Profile",
            "description": "적용할 사전 정의된 가중치 프로파일"
          },
          "include_manifest_metadata": {
            "type": "boolean",
            "title": "Include Manifest Metadata",
            "description": "매니페스트의 추가 메타데이터 포함 여부",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "item_codes"
        ],
        "title": "SimilaritySearchRequest"
      },
      "SimilaritySearchResponse": {
        "properties": {
          "results": {
            "items": {
              "$ref": "#/components/schemas/SimilaritySearchResult"
            },
            "type": "array",
            "title": "Results"
          },
          "metrics": {
            "type": "object",
            "title": "Metrics"
          }
        },
        "type": "object",
        "title": "SimilaritySearchResponse"
      },
      "SimilaritySearchResult": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code",
            "description": "조회 대상 품목 코드"
          },
          "matches": {
            "items": {
              "$ref": "#/components/schemas/SimilarItem"
            },
            "type": "array",
            "title": "Matches"
          },
          "manifest_revision": {
            "type": "string",
            "title": "Manifest Revision",
            "description": "매니페스트 버전/리비전 정보"
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "SimilaritySearchResult"
      },
      "TimeBreakdown": {
        "properties": {
          "proc_seq": {
            "type": "integer",
            "title": "Proc Seq",
            "description": "공정 순번"
          },
          "setup_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Setup Time",
            "description": "세팅 시간 합계"
          },
          "run_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Run Time",
            "description": "가공/운전 시간 합계"
          },
          "queue_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Queue Time",
            "description": "대기 시간 합계"
          },
          "wait_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Wait Time",
            "description": "정지/대기 시간 합계"
          },
          "move_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Move Time",
            "description": "이동 시간 합계"
          },
          "total_time": {
            "type": "number",
            "minimum": 0.0,
            "title": "Total Time",
            "description": "공정별 총 리드타임"
          }
        },
        "type": "object",
        "required": [
          "setup_time",
          "run_time",
          "queue_time",
          "wait_time",
          "move_time",
          "total_time"
        ],
        "title": "TimeBreakdown"
      },
      "TimeSummaryRequest": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "operations": {
            "items": {
              "$ref": "#/components/schemas/OperationStep"
            },
            "type": "array",
            "title": "Operations",
            "description": "리드타임 계산에 사용할 공정 데이터"
          },
          "include_breakdown": {
            "type": "boolean",
            "title": "Include Breakdown",
            "description": "공정별 상세 합계를 포함할지 여부",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "TimeSummaryRequest"
      },
      "TimeSummaryResponse": {
        "properties": {
          "item_code": {
            "type": "string",
            "title": "Item Code"
          },
          "totals": {
            "additionalProperties": {
              "type": "number"
            },
            "type": "object",
            "title": "Totals"
          },
          "process_count": {
            "type": "integer",
            "minimum": 0.0,
            "title": "Process Count",
            "default": 0
          },
          "breakdown": {
            "items": {
              "$ref": "#/components/schemas/TimeBreakdown"
            },
            "type": "array",
            "title": "Breakdown"
          }
        },
        "type": "object",
        "required": [
          "item_code"
        ],
        "title": "TimeSummaryResponse"
      },
      "TrainerRuntimeModel": {
        "properties": {
          "similarity_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity Threshold"
          },
          "trim_std_enabled": {
            "type": "boolean",
            "title": "Trim Std Enabled",
            "default": true
          },
          "trim_lower_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Lower Percent",
            "default": 0.05
          },
          "trim_upper_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Upper Percent",
            "default": 0.95
          },
          "time_profiles_enabled": {
            "type": "boolean",
            "title": "Time Profiles Enabled",
            "default": false
          },
          "time_profile_strategy": {
            "type": "string",
            "minLength": 1,
            "title": "Time Profile Strategy",
            "default": "sigma_profile"
          },
          "time_profile_optimal_sigma": {
            "type": "number",
            "minimum": 0.0,
            "title": "Time Profile Optimal Sigma",
            "default": 0.67
          },
          "time_profile_safe_sigma": {
            "type": "number",
            "minimum": 0.0,
            "title": "Time Profile Safe Sigma",
            "default": 1.28
          }
        },
        "type": "object",
        "required": [
          "similarity_threshold"
        ],
        "title": "TrainerRuntimeModel"
      },
      "TrainerRuntimePatch": {
        "properties": {
          "similarity_threshold": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Similarity Threshold"
          },
          "trim_std_enabled": {
            "type": "boolean",
            "title": "Trim Std Enabled"
          },
          "trim_lower_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Lower Percent"
          },
          "trim_upper_percent": {
            "type": "number",
            "maximum": 1.0,
            "minimum": 0.0,
            "title": "Trim Upper Percent"
          },
          "time_profiles_enabled": {
            "type": "boolean",
            "title": "Time Profiles Enabled"
          },
          "time_profile_strategy": {
            "type": "string",
            "minLength": 1,
            "title": "Time Profile Strategy"
          },
          "time_profile_optimal_sigma": {
            "type": "number",
            "minimum": 0.0,
            "title": "Time Profile Optimal Sigma"
          },
          "time_profile_safe_sigma": {
            "type": "number",
            "minimum": 0.0,
            "title": "Time Profile Safe Sigma"
          }
        },
        "type": "object",
        "title": "TrainerRuntimePatch"
      },
      "TrainingRequest": {
        "properties": {
          "version_label": {
            "type": "string",
            "maxLength": 64,
            "title": "Version Label"
          },
          "projector_metadata": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Projector Metadata"
          },
          "dry_run": {
            "type": "boolean",
            "title": "Dry Run",
            "default": false
          }
        },
        "type": "object",
        "title": "TrainingRequest"
      },
      "TrainingStatusModel": {
        "properties": {
          "job_id": {
            "type": "string",
            "title": "Job Id"
          },
          "status": {
            "type": "string",
            "title": "Status"
          },
          "started_at": {
            "type": "string",
            "title": "Started At"
          },
          "finished_at": {
            "type": "string",
            "title": "Finished At"
          },
          "progress": {
            "type": "integer",
            "title": "Progress"
          },
          "message": {
            "type": "string",
            "title": "Message"
          },
          "version_path": {
            "type": "string",
            "title": "Version Path"
          },
          "metrics": {
            "type": "object",
            "title": "Metrics"
          },
          "latest_version": {
            "type": "object",
            "title": "Latest Version"
          }
        },
        "type": "object",
        "required": [
          "status",
          "progress"
        ],
        "title": "TrainingStatusModel"
      },
      "UserStatusResponse": {
        "properties": {
          "username": {
            "type": "string",
            "title": "Username"
          },
          "display_name": {
            "type": "string",
            "title": "Display Name"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "approved",
              "rejected"
            ],
            "title": "Status"
          },
          "is_admin": {
            "type": "boolean",
            "title": "Is Admin",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "username",
          "status"
        ],
        "title": "UserStatusResponse"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      },
      "VisualizationConfigModel": {
        "properties": {
          "tensorboard_projector_dir": {
            "type": "string",
            "title": "Tensorboard Projector Dir"
          },
          "projector_enabled": {
            "type": "boolean",
            "title": "Projector Enabled",
            "default": true
          },
          "projector_metadata_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Projector Metadata Columns"
          },
          "neo4j_enabled": {
            "type": "boolean",
            "title": "Neo4J Enabled",
            "default": true
          },
          "neo4j_browser_url": {
            "type": "string",
            "title": "Neo4J Browser Url"
          },
          "neo4j_workspace": {
            "type": "string",
            "title": "Neo4J Workspace"
          },
          "publish_service_enabled": {
            "type": "boolean",
            "title": "Publish Service Enabled",
            "default": true
          },
          "publish_notes": {
            "type": "string",
            "title": "Publish Notes"
          }
        },
        "type": "object",
        "required": [
          "tensorboard_projector_dir"
        ],
        "title": "VisualizationConfigModel"
      },
      "VisualizationConfigPatch": {
        "properties": {
          "tensorboard_projector_dir": {
            "type": "string",
            "title": "Tensorboard Projector Dir"
          },
          "projector_enabled": {
            "type": "boolean",
            "title": "Projector Enabled"
          },
          "projector_metadata_columns": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Projector Metadata Columns"
          },
          "neo4j_enabled": {
            "type": "boolean",
            "title": "Neo4J Enabled"
          },
          "neo4j_browser_url": {
            "type": "string",
            "title": "Neo4J Browser Url"
          },
          "neo4j_workspace": {
            "type": "string",
            "title": "Neo4J Workspace"
          },
          "publish_service_enabled": {
            "type": "boolean",
            "title": "Publish Service Enabled"
          },
          "publish_notes": {
            "type": "string",
            "title": "Publish Notes"
          }
        },
        "type": "object",
        "title": "VisualizationConfigPatch"
      },
      "WorkflowConfigPatch": {
        "properties": {
          "graph": {
            "$ref": "#/components/schemas/WorkflowGraphPatch"
          },
          "trainer": {
            "$ref": "#/components/schemas/TrainerRuntimePatch"
          },
          "predictor": {
            "$ref": "#/components/schemas/PredictorRuntimePatch"
          },
          "sql": {
            "$ref": "#/components/schemas/SQLConfigPatch"
          },
          "data_source": {
            "$ref": "#/components/schemas/DataSourceConfigPatch"
          },
          "export": {
            "$ref": "#/components/schemas/ExportConfigPatch"
          },
          "visualization": {
            "$ref": "#/components/schemas/VisualizationConfigPatch"
          }
        },
        "type": "object",
        "title": "WorkflowConfigPatch"
      },
      "WorkflowConfigResponse": {
        "properties": {
          "graph": {
            "$ref": "#/components/schemas/WorkflowGraphModel"
          },
          "trainer": {
            "$ref": "#/components/schemas/TrainerRuntimeModel"
          },
          "predictor": {
            "$ref": "#/components/schemas/PredictorRuntimeModel"
          },
          "sql": {
            "$ref": "#/components/schemas/SQLConfigModel"
          },
          "data_source": {
            "$ref": "#/components/schemas/DataSourceConfigModel"
          },
          "export": {
            "$ref": "#/components/schemas/ExportConfigModel"
          },
          "visualization": {
            "$ref": "#/components/schemas/VisualizationConfigModel"
          },
          "updated_at": {
            "type": "string",
            "title": "Updated At"
          }
        },
        "type": "object",
        "required": [
          "graph",
          "trainer",
          "predictor",
          "sql",
          "data_source",
          "export",
          "visualization",
          "updated_at"
        ],
        "title": "WorkflowConfigResponse"
      },
      "WorkflowGraphEdge": {
        "properties": {
          "id": {
            "type": "string",
            "title": "Id"
          },
          "source": {
            "type": "string",
            "title": "Source"
          },
          "target": {
            "type": "string",
            "title": "Target"
          },
          "kind": {
            "type": "string",
            "title": "Kind"
          },
          "label": {
            "type": "string",
            "title": "Label"
          }
        },
        "type": "object",
        "required": [
          "id",
          "source",
          "target",
          "kind"
        ],
        "title": "WorkflowGraphEdge"
      },
      "WorkflowGraphModel": {
        "properties": {
          "nodes": {
            "items": {
              "$ref": "#/components/schemas/WorkflowGraphNode"
            },
            "type": "array",
            "title": "Nodes"
          },
          "edges": {
            "items": {
              "$ref": "#/components/schemas/WorkflowGraphEdge"
            },
            "type": "array",
            "title": "Edges"
          },
          "design_refs": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Design Refs"
          },
          "last_saved": {
            "type": "string",
            "title": "Last Saved"
          }
        },
        "type": "object",
        "title": "WorkflowGraphModel"
      },
      "WorkflowGraphNode": {
        "properties": {
          "id": {
            "type": "string",
            "title": "Id"
          },
          "label": {
            "type": "string",
            "title": "Label"
          },
          "type": {
            "type": "string",
            "title": "Type"
          },
          "category": {
            "type": "string",
            "title": "Category"
          },
          "status": {
            "type": "string",
            "title": "Status"
          },
          "position": {
            "additionalProperties": {
              "type": "number"
            },
            "type": "object",
            "title": "Position"
          },
          "settings": {
            "type": "object",
            "title": "Settings"
          },
          "metrics": {
            "type": "object",
            "title": "Metrics"
          },
          "doc_refs": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Doc Refs"
          }
        },
        "type": "object",
        "required": [
          "id",
          "label",
          "type"
        ],
        "title": "WorkflowGraphNode"
      },
      "WorkflowGraphPatch": {
        "properties": {
          "nodes": {
            "items": {
              "$ref": "#/components/schemas/WorkflowGraphNode"
            },
            "type": "array",
            "title": "Nodes"
          },
          "edges": {
            "items": {
              "$ref": "#/components/schemas/WorkflowGraphEdge"
            },
            "type": "array",
            "title": "Edges"
          },
          "design_refs": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Design Refs"
          }
        },
        "type": "object",
        "title": "WorkflowGraphPatch"
      },
      "WorkspaceSettingsPayload": {
        "properties": {
          "version": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "string"
              }
            ],
            "title": "Version"
          },
          "layout": {
            "type": "object",
            "title": "Layout"
          },
          "routing": {
            "type": "object",
            "title": "Routing"
          },
          "algorithm": {
            "type": "object",
            "title": "Algorithm"
          },
          "options": {
            "type": "object",
            "title": "Options"
          },
          "access": {
            "type": "object",
            "title": "MSSQL"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          }
        },
        "type": "object",
        "title": "WorkspaceSettingsPayload"
      },
      "WorkspaceSettingsResponse": {
        "properties": {
          "version": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "string"
              }
            ],
            "title": "Version"
          },
          "layout": {
            "type": "object",
            "title": "Layout"
          },
          "routing": {
            "type": "object",
            "title": "Routing"
          },
          "algorithm": {
            "type": "object",
            "title": "Algorithm"
          },
          "options": {
            "type": "object",
            "title": "Options"
          },
          "access": {
            "type": "object",
            "title": "MSSQL"
          },
          "metadata": {
            "type": "object",
            "title": "Metadata"
          },
          "updated_at": {
            "type": "string",
            "title": "Updated At"
          },
          "user": {
            "type": "string",
            "title": "User"
          }
        },
        "type": "object",
        "required": [
          "updated_at"
        ],
        "title": "WorkspaceSettingsResponse"
      },
      "UiAuditBatchRequest": {
        "title": "UiAuditBatchRequest",
        "type": "object",
        "properties": {
          "events": {
            "title": "Events",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AuditEvent"
            },
            "default": []
          },
          "source": {
            "title": "Source",
            "type": "string",
            "maxLength": 64
          }
        }
      }
    }
  }
} as const;

export type OpenApiSchema = typeof openApiSchema;
