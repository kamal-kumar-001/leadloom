/** Which sign-in methods are available. Resolved server-side at request time; no client fetch. */
export interface AuthMethods {
  github: boolean;
  google: boolean;
  password: boolean;
}
