export function buildMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && page <= totalPages + 1,
    },
  };
}
