{myNodes.length > 0 ? (
                myNodes.map((n, idx) => {
                  // Fix: correctly identify unclaimed nodes even if is_claimed is null in DB
                  const isUnclaimed = !n.is_claimed || !!n.claim_pin;
                  const isPrimary = !isUnclaimed && n.user_id === session?.user?.id;