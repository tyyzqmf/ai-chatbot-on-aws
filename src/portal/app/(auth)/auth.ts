import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import CognitoProvider from 'next-auth/providers/cognito';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    CognitoProvider({
      clientId: process.env.AUTH_COGNITO_ID ?? '',
      clientSecret: process.env.AUTH_COGNITO_SECRET ?? '',
      issuer: process.env.AUTH_COGNITO_ISSUER ?? '',
      checks:
        process.env.NODE_ENV !== 'development' ? ['pkce', 'nonce'] : ['none'],
    }),
  ],
  callbacks: {
    async jwt({ token, account }: { token: any; account: any }) {
      // need to handle token refresh https://next-auth.js.org/tutorials/refresh-token-rotation
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Send properties to the client, like an access_token and user id from a provider.
      if (session) {
        session = Object.assign({}, session, {
          accessToken: token.accessToken,
          user: {
            ...session.user,
            id: token.sub,
          },
        });
      }
      return session;
    },
  },
});
