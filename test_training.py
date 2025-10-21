#!/usr/bin/env python
"""Test script to trigger model training directly."""
import asyncio
from backend.api.services.training_service import training_service

async def main():
    print("=" * 60)
    print("Starting model training test...")
    print("=" * 60)

    try:
        result = training_service.start_training(
            version_label="test_phase2",
            projector_metadata=["ITEM_CD", "ITEM_NM"],
            requested_by="test_user",
            dry_run=False
        )

        print(f"\n✅ Training started successfully!")
        print(f"Job ID: {result.get('job_id')}")
        print(f"Status: {result.get('status')}")
        print(f"Message: {result.get('message')}")

        # Poll for status
        import time
        print("\nMonitoring training progress...")
        for i in range(60):  # Monitor for up to 5 minutes
            time.sleep(5)
            status = training_service.get_status()
            print(f"[{i*5}s] Status: {status.get('status')} | Progress: {status.get('progress')}% | {status.get('message', '')}")

            if status.get('status') in ['completed', 'failed', 'error']:
                print(f"\n{'✅' if status.get('status') == 'completed' else '❌'} Training {status.get('status')}!")
                if status.get('version_path'):
                    print(f"Model saved to: {status.get('version_path')}")
                break

    except Exception as e:
        print(f"\n❌ Training failed with error:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
