export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export function buildListResponse<T>(input: {
  data: T[];
  page: number;
  limit: number;
  total: number;
}): ListResponse<T> {
  const { data, page, limit, total } = input;
  const totalPages = total <= 0 ? 0 : Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
