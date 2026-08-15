import { tokenStorage } from './tokenStorage';
import apiClient, { databaseUrl, setSessionHandlers } from './apiClient';

class SessionService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.isLoading = true;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  getState() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      user: this.user,
      isLoading: this.isLoading,
      isAuthenticated: Boolean(this.accessToken && this.user),
    };
  }

  async initSession() {
    this.isLoading = true;
    this.notify();

    try {
      const { accessToken, refreshToken, user } = await tokenStorage.getSession();
      if (accessToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.user = user;

        // Validate session server-side via GET /auth/me
        try {
          const response = await apiClient.get(databaseUrl('/auth/me'));
          const userPayload = response.data?.data || response.data?.user || response.data;
          if (userPayload) {
            this.user = userPayload;
          }
        } catch (authError) {
          // If 401 refresh failed, apiClient's interceptor already triggered clearSession().
          // If network/offline error, log warning and preserve local session.
          console.warn('[SessionService] /auth/me validation warning:', authError.message || authError);
        }
      } else {
        await tokenStorage.clearSession();
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
      }
    } catch (error) {
      console.error('[SessionService] Failed to read stored session:', error);
      await tokenStorage.clearSession();
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  async setSession({ accessToken, refreshToken, user }) {
    if (accessToken !== undefined) this.accessToken = accessToken;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;
    if (user !== undefined) this.user = user;

    await tokenStorage.saveSession({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      user: this.user,
    });

    this.notify();
  }

  async clearSession() {
    if (this.accessToken) {
      try {
        await apiClient.post(databaseUrl('/auth/logout'), {});
      } catch (error) {
        console.warn('[SessionService] Server-side logout call failed:', error.message || error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    await tokenStorage.clearSession();
    this.notify();
  }
}

export const sessionService = new SessionService();

// Register handlers with apiClient to avoid circular dependency
setSessionHandlers({
  onExpired: () => sessionService.clearSession(),
  onUpdated: (data) => sessionService.setSession(data),
});
