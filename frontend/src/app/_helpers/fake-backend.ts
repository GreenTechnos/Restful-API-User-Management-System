import { Observable, of, throwError } from 'rxjs';
import { delay, materialize, dematerialize } from 'rxjs/operators';
import { AlertService } from '@app/_services';
import { Role } from '@app/_models';
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HTTP_INTERCEPTORS } from '@angular/common/http';

interface Account {
    id: number;
    title?: string;
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
    password: string;
    confirmPassword?: string;
    dateCreated: string;
    isVerified: boolean;
    verificationToken?: string;
    resetToken?: string;
    resetTokenExpires?: string;
    refreshTokens: string[];
}

interface JwtToken {
    exp: number;
    id: number;
}

// array in local storage for accounts
const accountsKey = 'angular-10-signup-verification-boilerplate-accounts';
let accounts: Account[] = JSON.parse(localStorage.getItem(accountsKey) || '[]');

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    constructor(private alertService: AlertService) {}

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const { url, method, headers, body } = request;
        const alertService = this.alertService;
        return handleRoute();

        function handleRoute() {
            switch (true) {
                case url.endsWith('/accounts/authenticate') && method === 'POST':
                    return authenticate();
                case url.endsWith('/accounts/refresh-token') && method === 'POST':
                    return refreshToken();
                case url.endsWith('/accounts/revoke-token') && method === 'POST':
                    return revokeToken();
                case url.endsWith('/accounts/register') && method === 'POST':
                    return register();
                case url.endsWith('/accounts/verify-email') && method === 'POST':
                    return verifyEmail();
                case url.endsWith('/accounts/forgot-password') && method === 'POST':
                    return forgotPassword();
                case url.endsWith('/accounts/validate-reset-token') && method === 'POST':
                    return validateResetToken();
                case url.endsWith('/accounts/reset-password') && method === 'POST':
                    return resetPassword(body);
                case url.endsWith('/accounts') && method === 'GET':
                    return getAccounts();
                case url.match(/\/accounts\/\d+$/) && method === 'GET':
                    return getAccountById();
                case url.endsWith('/accounts') && method === 'POST':
                    return createAccount();
                case url.match(/\/accounts\/\d+$/) && method === 'PUT':
                    return updateAccount();
                case url.match(/\/accounts\/\d+$/) && method === 'DELETE':
                    return deleteAccount();
                default:
                    return next.handle(request);
            }
        }

        // route functions
        function authenticate() {
            const { email, password } = body;
            const account = accounts.find(x => x.email === email && x.password === password && x.isVerified);
            if (!account) return error('Email or password is incorrect');
            
            account.refreshTokens.push(generateRefreshToken());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok({
                ...basicDetails(account),
                jwtToken: generateJwtToken(account)
            });
        }

        function refreshToken() {
            const refreshToken = getRefreshToken();
            if (!refreshToken) return unauthorized();
            const account = accounts.find(x => x.refreshTokens.includes(refreshToken));
            if (!account) return unauthorized();

            account.refreshTokens = account.refreshTokens.filter(x => x !== refreshToken);
            account.refreshTokens.push(generateRefreshToken());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok({
                ...basicDetails(account),
                jwtToken: generateJwtToken(account)
            });
        }

        function revokeToken() {
            if (!isAuthenticated()) return unauthorized();

            const refreshToken = getRefreshToken();
            const account = refreshToken && accounts.find(x => x.refreshTokens.includes(refreshToken));

            if (!account) return unauthorized();

            account.refreshTokens = account.refreshTokens.filter(x => x !== refreshToken);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }

        function register() {
            const account = body as Account;
        
            if (accounts.find(x => x.email === account.email)) {
                setTimeout(() => {
                    alertService.info(
                        `<h4>Email Already Registered</h4>
                        <p>Your email ${account.email} is already registered.</p>
                        <p>If you don't know your password please visit the <a href="${location.origin}/account/forgot-password">forgot password</a> page.</p>
                        <div><strong>NOTE:</strong> The fake backend displayed this "email" so you can test without an api. A real backend would send a real email.</div>`,
                        { autoClose: false }
                    );
                }, 1000);
                return ok();
            }
        
            account.id = newAccountId();
            account.role = account.id === 1 ? Role.Admin : Role.User;
            account.dateCreated = new Date().toISOString();
            account.verificationToken = new Date().getTime().toString();
            account.isVerified = false;
            account.refreshTokens = [];
            delete account.confirmPassword;
            accounts.push(account);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            setTimeout(() => {
                const verifyUrl = `${location.origin}/account/verify-email?token=${account.verificationToken}`;
                alertService.info(
                    `<h4>Verification Email</h4>
                    <p>Thanks for registering!</p>
                    <p>Please click the below link to verify your email address:</p>
                    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                    <div><strong>NOTE:</strong> The fake backend displayed this "email" so you can test without an api. A real backend would send a real email.</div>`,
                    { autoClose: false }
                );
            }, 1000);

            return ok();
        }

        function verifyEmail() {
            const { token } = body;
            const account = accounts.find(x => !!x.verificationToken && x.verificationToken === token);
        
            if (!account) return error('Verification failed');
        
            account.isVerified = true;
            delete account.verificationToken;
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }

        function forgotPassword() {
            const { email } = body;
            const account = accounts.find(x => x.email === email);
        
            if (!account) return ok();
        
            account.resetToken = new Date().getTime().toString();
            account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
        
            setTimeout(() => {
                const resetUrl = `${location.origin}/account/reset-password?token=${account.resetToken}`;
                alertService.info(`
                    <h4>Reset Password Email</h4>
                    <p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                    <p><a href="${resetUrl}">${resetUrl}</a></p>
                    <p>NOTE: The fake backend displayed this email so you can test without an api. A real backend would send a real email.</p>
                `, { autoClose: false });
            }, 1000);
        
            return ok();
        }

        function validateResetToken() {
            const { token } = body;
            const account = accounts.find(x => 
                !!x.resetToken && 
                x.resetToken === token &&
                new Date() < new Date(x.resetTokenExpires!)
            );
            if (!account) return error('Invalid token');
            return ok();
        }

        function resetPassword(body: { token: string; password: string }) {
            const { token, password } = body;
            const account = accounts.find(x =>
                !!x.resetToken && 
                x.resetToken === token &&
                new Date() < new Date(x.resetTokenExpires!)
            );
        
            if (!account) return error('Invalid token');
        
            account.password = password;
            account.isVerified = true;
            delete account.resetToken;
            delete account.resetTokenExpires;
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }
        
        function getAccounts() {
            if (!isAuthenticated()) return unauthorized();
            return ok(accounts.map(x => basicDetails(x)));
        }
        
        function getAccountById() {
            if (!isAuthenticated()) return unauthorized();
        
            const account = accounts.find(x => x.id === idFromUrl());
            const current = currentAccount();
        
            if (!account || !current || (account.id !== current.id && !isAuthorized(Role.Admin))) {
                return unauthorized();
            }
        
            return ok(basicDetails(account));
        }

        function createAccount() {
            if (!isAuthorized(Role.Admin)) return unauthorized();
        
            const account = body as Account;
        
            if (accounts.find(x => x.email === account.email)) {
                return error(`Email ${account.email} is already registered`);
            }
        
            account.id = newAccountId();
            account.dateCreated = new Date().toISOString();
            account.isVerified = true;
            account.refreshTokens = [];
            delete account.confirmPassword;
            accounts.push(account);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }

        function updateAccount() {
            if (!isAuthenticated()) return unauthorized();
        
            const params = body;
            const account = accounts.find(x => x.id === idFromUrl());
            const current = currentAccount();
        
            if (!account || !current || (account.id !== current.id && !isAuthorized(Role.Admin))) {
                return unauthorized();
            }
        
            if (!params.password) {
                delete params.password;
            }
        
            delete params.confirmPassword;
        
            Object.assign(account, params);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok(basicDetails(account));
        }

        function deleteAccount() {
            if (!isAuthenticated()) return unauthorized();
        
            const account = accounts.find(x => x.id === idFromUrl());
            const current = currentAccount();
        
            if (!account || !current || (account.id !== current.id && !isAuthorized(Role.Admin))) {
                return unauthorized();
            }
        
            accounts = accounts.filter(x => x.id !== idFromUrl());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }
        
        // helper functions
        function ok(body?: any): Observable<HttpResponse<any>> {
            return of(new HttpResponse({ status: 200, body }))
                .pipe(delay(500));
        }
        
        function error(message: string): Observable<never> {
            return throwError(() => ({ error: message }))
                .pipe(materialize(), delay(500), dematerialize());
        }
        
        function unauthorized(): Observable<never> {
            return throwError(() => ({ status: 401, error: { message: 'Unauthorized' } }))
                .pipe(materialize(), delay(500), dematerialize());
        }
        
        function basicDetails(account: Account): Omit<Account, 'password' | 'refreshTokens'> {
            const { id, title, firstName, lastName, email, role, dateCreated, isVerified } = account;
            return { id, title, firstName, lastName, email, role, dateCreated, isVerified };
        }
        
        function isAuthenticated(): boolean {
            return !!currentAccount();
        }
        
        function isAuthorized(role: Role): boolean {
            const account = currentAccount();
            return account?.role === role;
        }
        
        function idFromUrl(): number {
            const urlParts = url.split('/');
            return parseInt(urlParts[urlParts.length - 1]);
        }
        
        function newAccountId(): number {
            return accounts.length ? Math.max(...accounts.map(x => x.id)) + 1 : 1;
        }
        
        function currentAccount(): Account | null {
            const authHeader = headers.get('Authorization');
            if (!authHeader?.startsWith('Bearer fake-jwt-token')) return null;
        
            const token = authHeader.split('.')[1];
            if (!token) return null;
            
            let jwtToken: JwtToken;
            try {
                jwtToken = JSON.parse(atob(token));
            } catch {
                return null;
            }
            
            if (Date.now() > (jwtToken.exp * 1000)) return null;
        
            return accounts.find(x => x.id === jwtToken.id) || null;
        }
        
        function generateJwtToken(account: Account): string {
            const tokenPayload: JwtToken = {
                exp: Math.round(new Date(Date.now() + 15 * 60 * 1000).getTime() / 1000),
                id: account.id
            };
            return `fake-jwt-token.${btoa(JSON.stringify(tokenPayload))}`;
        }

        function generateRefreshToken(): string {
            const token = new Date().getTime().toString();
            const expires = new Date(Date.now() + 7*24*60*60*1000).toUTCString();
            document.cookie = `fakeRefreshToken=${token}; expires=${expires}; path=/`;
            return token;
        }

        function getRefreshToken(): string | undefined {
            return (document.cookie.split(';').find(x => x.includes('fakeRefreshToken')) || '=').split('=')[1];
        }
    }
}

export const fakeBackendProvider = {
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};