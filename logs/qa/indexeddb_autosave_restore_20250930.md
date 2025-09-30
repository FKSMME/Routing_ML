# IndexedDB Autosave QA Log (2025-09-30T05:23:03.977Z)

## Summary
- Verified routing store autosave writes snapshots via `frontend/src/lib/persistence/indexedDbPersistence.ts`.
- Confirmed audit queue records save and restore actions when snapshots are read on new store instances.

## Timeline Titles
- Before edit: ["CUT","GRIND","POLISH"]
- After edit: ["GRIND","POLISH"]
- After reload: ["GRIND","POLISH"]

## Snapshot Store (latest entry)
```json
{
  "id": "622547ef-7dbf-453e-8396-8dd7a0e938d5",
  "createdAt": "2025-09-30T05:22:32.977Z",
  "state": {
    "activeProductId": "ITEM-001",
    "activeItemId": "ITEM-001",
    "productTabs": [
      {
        "id": "ITEM-001",
        "productCode": "ITEM-001",
        "productName": "ITEM-001",
        "candidateId": "CAND-1",
        "timeline": [
          {
            "id": "1f7fa7e7-eda1-405e-9c99-e82e8391d984",
            "seq": 1,
            "processCode": "GRIND",
            "description": "Grinding",
            "setupTime": 5,
            "runTime": 18,
            "waitTime": 0,
            "itemCode": "ITEM-001",
            "candidateId": "CAND-1",
            "violations": [],
            "positionX": 0
          },
          {
            "id": "e45b7a5e-0091-4378-b5ac-09a63bfa0bb1",
            "seq": 2,
            "processCode": "POLISH",
            "description": "Polishing",
            "setupTime": 3,
            "runTime": 15,
            "waitTime": 2,
            "itemCode": "ITEM-001",
            "candidateId": "CAND-1",
            "violations": [],
            "positionX": 240
          }
        ]
      }
    ],
    "timeline": [
      {
        "id": "1f7fa7e7-eda1-405e-9c99-e82e8391d984",
        "seq": 1,
        "processCode": "GRIND",
        "description": "Grinding",
        "setupTime": 5,
        "runTime": 18,
        "waitTime": 0,
        "itemCode": "ITEM-001",
        "candidateId": "CAND-1",
        "violations": [],
        "positionX": 0
      },
      {
        "id": "e45b7a5e-0091-4378-b5ac-09a63bfa0bb1",
        "seq": 2,
        "processCode": "POLISH",
        "description": "Polishing",
        "setupTime": 3,
        "runTime": 15,
        "waitTime": 2,
        "itemCode": "ITEM-001",
        "candidateId": "CAND-1",
        "violations": [],
        "positionX": 240
      }
    ],
    "lastSuccessfulTimeline": {
      "ITEM-001": [
        {
          "id": "c302f6ba-363d-44fa-a4e1-e161580badca",
          "seq": 1,
          "processCode": "CUT",
          "description": "Cutting",
          "setupTime": 4,
          "runTime": 12,
          "waitTime": 1,
          "itemCode": "ITEM-001",
          "candidateId": "CAND-1",
          "violations": [],
          "positionX": 0
        },
        {
          "id": "1f7fa7e7-eda1-405e-9c99-e82e8391d984",
          "seq": 2,
          "processCode": "GRIND",
          "description": "Grinding",
          "setupTime": 5,
          "runTime": 18,
          "waitTime": 0,
          "itemCode": "ITEM-001",
          "candidateId": "CAND-1",
          "violations": [],
          "positionX": 240
        },
        {
          "id": "e45b7a5e-0091-4378-b5ac-09a63bfa0bb1",
          "seq": 3,
          "processCode": "POLISH",
          "description": "Polishing",
          "setupTime": 3,
          "runTime": 15,
          "waitTime": 2,
          "itemCode": "ITEM-001",
          "candidateId": "CAND-1",
          "violations": [],
          "positionX": 480
        }
      ]
    },
    "dirty": true
  },
  "version": 1,
  "persisted": true
}
```

## Audit Queue (entries)
```json
[
  {
    "id": "7ee8a16d-ba18-43e5-bd1c-7a2e52217771",
    "action": "routing.snapshot.restore",
    "level": "info",
    "message": "Restored routing workspace snapshot from IndexedDB.",
    "context": {
      "snapshotId": "622547ef-7dbf-453e-8396-8dd7a0e938d5",
      "tabCount": 1
    },
    "createdAt": "2025-09-30T05:22:33.977Z",
    "persisted": true
  },
  {
    "id": "bd1f9c7c-1c21-425a-81c1-4def6f7e153c",
    "action": "routing.snapshot.save",
    "level": "info",
    "message": "Saved routing workspace snapshot to IndexedDB.",
    "context": {
      "snapshotId": "622547ef-7dbf-453e-8396-8dd7a0e938d5",
      "activeProductId": "ITEM-001",
      "dirty": true
    },
    "createdAt": "2025-09-30T05:22:32.977Z",
    "persisted": true
  },
  {
    "id": "ec8b8770-4c5b-4211-8c01-09e9b448c023",
    "action": "routing.snapshot.save",
    "level": "info",
    "message": "Saved routing workspace snapshot to IndexedDB.",
    "context": {
      "snapshotId": "4364772e-7763-4194-98af-cb09c19bd9ee",
      "activeProductId": "ITEM-001",
      "dirty": true
    },
    "createdAt": "2025-09-30T05:23:03.977Z",
    "persisted": true
  }
]
```

## Execution
- Command: `npm run test -- --run frontend/tests/evidence/indexeddb_autosave_capture.test.ts`
