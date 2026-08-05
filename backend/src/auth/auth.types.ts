export interface JwtPayload {
  sub: number;
  email: string;
  roleId: number;
  roleName: string;
}

/** Shape attached to `req.user` once JwtAuthGuard has run. */
export interface AuthenticatedUser {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
}
