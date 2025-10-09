import { useEffect, useState } from 'react';

interface PurchaseOrderItem {
  ITEM_CD: string;
  PO_NO: string;
  PO_DATE: string;
  QTY: number;
  UNIT_PRICE: number;
  VENDOR_CD: string;
  VENDOR_NM: string;
}

export function usePurchaseOrderItems() {
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/items/purchase-orders?limit=50', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch purchase order items:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, []);

  return { items, isLoading, error };
}
