export interface RequestUser {
  id: string;
  username: string;
  role: 'staff' | 'manager' | 'admin';
}

export interface AuthenticatedRequest {
  user: RequestUser;
}
