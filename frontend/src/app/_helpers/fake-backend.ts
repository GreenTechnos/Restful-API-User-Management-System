import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpResponse,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HTTP_INTERCEPTORS,
    HttpErrorResponse,
    HttpHeaders
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, mergeMap, materialize, dematerialize } from 'rxjs/operators';

import { AlertService } from '@app/_services'; // Assuming this path is correct
import { Role } from '@app/_models';        // Assuming this path is correct

// --- Interfaces - Combining and refining ---
interface Account {
    id: number;
    title: string;
    firstName?: string;
    lastName?: string;
    email: string;
    password?: string; // Should be hashed in a real app, stored as-is for fake backend comparison
    role: Role | string;
    employeeId?: number; // Link to an employee
    jwtToken?: string; // For the access token (typically not stored with user, but for response)
    dateCreated?: string;
    dateUpdated?: string;
    isVerified?: boolean;
    verificationToken?: string;
    resetToken?: string;
    resetTokenExpires?: Date | string; // Store as ISO string or Date object
    refreshTokens?: string[]; // Array of active refresh tokens
    status?: 'Active' | 'Inactive' | string;
}

interface Employee {
    id: number;
    employeeId: string; // The 'EMP001' style ID
    userId: number; // This should link to Account.id
    email: string; // Optional: If you want to link email to employee
    position: string;
    departmentId: number;
    hireDate: string;
    status: string;
}

interface Department {
    id: number;
    name: string;
    description: string;
    employeeCount: number;
}

interface Workflow {
    id: number;
    employeeId: number;
    type: string;
    details: any;
    status: string;
    // Optional: Add a creation timestamp if you want to sort by it
    datetimecreated?: string; // Example from a previous context if needed for sorting
}

interface AppRequest { // Renamed from 'RequestItem' to avoid conflict with HttpRequest
    id: number;
    employeeId: number;
    type: string;
    requestItems: { name: string; quantity: number }[];
    status: string;
}

// Key for localStorage
const accountsKey = 'app-hr-tool-accounts'; // Made key more specific

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    // --- Data Management ---
    private accounts: Account[];

    // In-memory for other entities
    private employees: Employee[] = [
        { id: 1, employeeId: 'EMP001', userId: 1, email: 'admin@example.com', position: 'Developer', departmentId: 1, hireDate: '2025-01-01', status: 'Active' },
        { id: 2, employeeId: 'EMP002', userId: 2, email: 'user@example.com', position: 'Designer', departmentId: 2, hireDate: '2025-02-01', status: 'Active' }
    ];
    private departments: Department[] = [
        { id: 1, name: 'Engineering', description: 'Software development team', employeeCount: 1 },
        { id: 2, name: 'Marketing', description: 'Marketing team', employeeCount: 1 }
    ];
    private workflows: Workflow[] = [
        { id: 1, employeeId: 1, type: 'Onboarding', details: { task: 'Setup workstation' }, status: 'Pending', datetimecreated: new Date(Date.now() - 100000).toISOString() },
        { id: 2, employeeId: 2, type: 'Offboarding', details: { task: 'Return equipment' }, status: 'Completed', datetimecreated: new Date(Date.now() - 200000).toISOString() }
    ];
    private appRequests: AppRequest[] = [
        { id: 1, employeeId: 2, type: 'Equipment', requestItems: [{ name: 'Laptop', quantity: 1 }], status: 'Pending' }
    ];

    // ID Generators for in-memory entities
    private nextEmployeeId = this.employees.length > 0 ? Math.max(0, ...this.employees.map(e => e.id)) + 1 : 1;
    private nextDepartmentId = this.departments.length > 0 ? Math.max(0, ...this.departments.map(d => d.id)) + 1 : 1;
    private nextWorkflowId = this.workflows.length > 0 ? Math.max(0, ...this.workflows.map(w => w.id)) + 1 : 1;
    private nextAppRequestId = this.appRequests.length > 0 ? Math.max(0, ...this.appRequests.map(r => r.id)) + 1 : 1;

    constructor(private alertService: AlertService) {
        this.accounts = JSON.parse(localStorage.getItem(accountsKey)) || [];
        // Ensure default admin/user if local storage is empty or new
        if (this.accounts.length === 0) {
            this.accounts.push({
                id: 1, title: 'Mr', email: 'admin@example.com', password: 'admin', role: Role.Admin, employeeId: 1,
                isVerified: true, status: 'Active', refreshTokens: [], dateCreated: new Date().toISOString(),
                firstName: 'Admin', lastName: 'User'
            });
            this.accounts.push({
                id: 2, title: 'Mr', email: 'user@example.com', password: 'user', role: Role.User, employeeId: 2,
                isVerified: true, status: 'Active', refreshTokens: [], dateCreated: new Date().toISOString(),
                firstName: 'Normal', lastName: 'User'
            });
            this.saveAccounts();
        }
    }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const { url, method, headers, body } = request;

        return of(null)
            .pipe(mergeMap(() => this.handleRoute(url, method, headers as HttpHeaders, body, next)))
            .pipe(materialize())
            .pipe(delay(500))
            .pipe(dematerialize());
    }

    private handleRoute(url: string, method: string, headers: HttpHeaders, body: any, next: HttpHandler): Observable<HttpEvent<any>> {
        // --- ACCOUNT MANAGEMENT ROUTES ---
        switch (true) {
            case url.endsWith('/accounts/authenticate') && method === 'POST':
                return this.authenticate(body, headers);
            case url.endsWith('/accounts/refresh-token') && method === 'POST':
                return this.refreshToken(body, headers);
            case url.endsWith('/accounts/revoke-token') && method === 'POST':
                return this.revokeToken(body, headers);
            case url.endsWith('/accounts/register') && method === 'POST':
                return this.register(body);
            case url.endsWith('/accounts/verify-email') && method === 'POST':
                return this.verifyEmail(body);
            case url.endsWith('/accounts/forgot-password') && method === 'POST':
                return this.forgotPassword(body);
            case url.endsWith('/accounts/validate-reset-token') && method === 'POST':
                return this.validateResetToken(body);
            case url.endsWith('/accounts/reset-password') && method === 'POST':
                return this.resetPassword(body);
            case url.endsWith('/accounts') && method === 'GET':
                return this.getAccounts(headers);
            case url.match(/\/accounts\/(\d+)$/) && method === 'GET':
                return this.getAccountById(this.idFromUrl(url), headers);
            case url.endsWith('/accounts') && method === 'POST':
                return this.createAccount(body, headers);
            case url.match(/\/accounts\/(\d+)$/) && method === 'PUT':
                return this.updateAccount(this.idFromUrl(url), body, headers);
            case url.match(/\/accounts\/(\d+)$/) && method === 'DELETE':
                return this.deleteAccount(this.idFromUrl(url), headers);

            // --- OTHER ENTITY ROUTES ---
            // Employees
            case url.endsWith('/employees') && method === 'GET':
                return this.authorize(headers, null, () => this.ok(this.employees));
            case url.endsWith('/employees') && method === 'POST':
                return this.authorize(headers, Role.Admin, () => {
                    const newEmployee: Employee = { id: this.nextEmployeeId++, ...body };
                    this.employees.push(newEmployee);
                    const dept = this.departments.find(d => d.id === newEmployee.departmentId);
                    if (dept) dept.employeeCount++;
                    return this.ok(newEmployee, 201);
                });
            case url.match(/\/employees\/(\d+)$/) && method === 'GET': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, null, () => {
                    const employee = this.employees.find(e => e.id === id);
                    return employee ? this.ok(employee) : this.error('Employee not found', 404);
                });
            }
            case url.match(/\/employees\/(\d+)$/) && method === 'PUT': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, Role.Admin, () => {
                    const employeeIndex = this.employees.findIndex(e => e.id === id);
                    if (employeeIndex === -1) return this.error('Employee not found', 404);
                    const oldEmployeeData = this.employees[employeeIndex];
                    const updatedEmployee = { ...oldEmployeeData, ...body, id };
                    if (oldEmployeeData.departmentId !== updatedEmployee.departmentId) {
                        const oldDept = this.departments.find(d => d.id === oldEmployeeData.departmentId);
                        if (oldDept) oldDept.employeeCount = Math.max(0, oldDept.employeeCount - 1);
                        const newDept = this.departments.find(d => d.id === updatedEmployee.departmentId);
                        if (newDept) newDept.employeeCount++;
                        else return this.error('Target department not found', 400);
                    }
                    this.employees[employeeIndex] = updatedEmployee;
                    return this.ok(this.employees[employeeIndex]);
                });
            }
            case url.match(/\/employees\/(\d+)$/) && method === 'DELETE': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, Role.Admin, () => {
                    const employeeIndex = this.employees.findIndex(e => e.id === id);
                    if (employeeIndex === -1) return this.error('Employee not found', 404);
                    const deletedEmployee = this.employees.splice(employeeIndex, 1)[0];
                    if (deletedEmployee) {
                        const dept = this.departments.find(d => d.id === deletedEmployee.departmentId);
                        if (dept) dept.employeeCount = Math.max(0, dept.employeeCount - 1);
                    }
                    return this.ok({ message: 'Employee deleted' });
                });
            }
            case url.match(/\/employees\/(\d+)\/transfer$/) && method === 'POST': {
                const idMatch = url.match(/\/employees\/(\d+)\/transfer$/);
                if (!idMatch) return this.error('Invalid URL for employee transfer', 400);
                const id = parseInt(idMatch[1]);
                return this.authorize(headers, Role.Admin, () => {
                    const employee = this.employees.find(e => e.id === id);
                    if (!employee) return this.error('Employee not found', 404);
                    const oldDepartmentId = employee.departmentId;
                    const newDepartmentId = body.departmentId;
                    if (oldDepartmentId !== newDepartmentId) {
                        const oldDept = this.departments.find(d => d.id === oldDepartmentId);
                        if (oldDept) oldDept.employeeCount = Math.max(0, oldDept.employeeCount - 1);
                        const newDept = this.departments.find(d => d.id === newDepartmentId);
                        if (newDept) newDept.employeeCount++;
                        else return this.error('Target department not found', 400);
                    }
                    employee.departmentId = newDepartmentId;
                    this.workflows.push({
                        id: this.nextWorkflowId++, employeeId: id, type: 'Transfer',
                        details: body, status: 'Pending', datetimecreated: new Date().toISOString()
                    });
                    return this.ok({ message: 'Employee transferred successfully', employee });
                });
            }

            // Departments
            case url.endsWith('/departments') && method === 'GET':
                return this.authorize(headers, null, () => this.ok(this.departments));
            case url.endsWith('/departments') && method === 'POST':
                return this.authorize(headers, Role.Admin, () => {
                    const newDepartment: Department = { id: this.nextDepartmentId++, ...body, employeeCount: 0 };
                    this.departments.push(newDepartment);
                    return this.ok(newDepartment, 201);
                });

            case url.match(/\/departments\/(\d+)$/) && method === 'GET': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, null, () => { // Or specific role if needed
                    const department = this.departments.find(d => d.id === id);
                    return department ? this.ok(department) : this.error(`Department with id ${id} not found`, 404);
                });
            }
            case url.match(/\/departments\/(\d+)$/) && method === 'PUT': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, Role.Admin, () => {
                    const deptIndex = this.departments.findIndex(d => d.id === id);
                    if (deptIndex === -1) return this.error('Department not found', 404);
                    this.departments[deptIndex] = { ...this.departments[deptIndex], ...body, id };
                    return this.ok(this.departments[deptIndex]);
                });
            }
            case url.match(/\/departments\/(\d+)$/) && method === 'DELETE': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, Role.Admin, () => {
                    const dept = this.departments.find(d => d.id === id);
                    if (!dept) return this.error('Department not found', 404);
                    if (dept.employeeCount > 0) return this.error('Cannot delete department with active employees.', 400);
                    this.departments = this.departments.filter(d => d.id !== id);
                    return this.ok({ message: 'Department deleted' });
                });
            }


            // Workflows
            case url.match(/\/workflows\/employee\/(\d+)$/) && method === 'GET': {
                const idMatch = url.match(/\/workflows\/employee\/(\d+)$/);
                if (!idMatch) return this.error('Invalid URL for employee workflows', 400);
                const employeeId = parseInt(idMatch[1]);
                return this.authorize(headers, null, () => {
                    const workflows = this.workflows.filter(w => w.employeeId === employeeId);
                    return this.ok(workflows);
                });
            }
            case url.endsWith('/workflows') && method === 'POST':
                return this.authorize(headers, Role.Admin, () => {
                    const newWorkflow: Workflow = {
                        id: this.nextWorkflowId++,
                        ...body,
                        datetimecreated: new Date().toISOString() // Add timestamp on creation
                    };
                    this.workflows.push(newWorkflow);
                    return this.ok(newWorkflow, 201);
                });
            // *** ADDED HANDLER FOR GET /workflows ***
            case url.endsWith('/workflows') && method === 'GET':
                return this.authorize(headers, Role.Admin, () => { // Or null if all users can see all workflows
                    // Optional: sort workflows if not already handled by client or a specific query param
                    const sortedWorkflows = [...this.workflows].sort((a, b) => {
                        const dateA = new Date(a.datetimecreated || 0).getTime();
                        const dateB = new Date(b.datetimecreated || 0).getTime();
                        return dateB - dateA; // Descending
                    });
                    return this.ok(sortedWorkflows);
                });

            // AppRequests
            case url.endsWith('/requests') && method === 'GET':
                return this.authorize(headers, null, () => {
                    const currentAcc = this.currentAccount(headers);
                    if (!currentAcc) return this.unauthorized();
                    if (currentAcc.role === Role.Admin) return this.ok(this.appRequests);

                    const userRequests = this.appRequests.filter(r => {
                        const emp = this.employees.find(e => e.id === r.employeeId);
                        return emp && emp.userId === currentAcc.id;
                    });
                    return this.ok(userRequests);
                });
            case url.endsWith('/requests') && method === 'POST':
                return this.authorize(headers, null, () => {
                    const currentAcc = this.currentAccount(headers);
                    if (!currentAcc || !currentAcc.employeeId) return this.error("User not linked to an employee or not authenticated.", 400);

                    const newRequest: AppRequest = { id: this.nextAppRequestId++, employeeId: currentAcc.employeeId, ...body, status: 'Pending' };
                    this.appRequests.push(newRequest);
                    return this.ok(newRequest, 201);
                });
            case url.match(/\/requests\/(\d+)$/) && method === 'GET': {
                const id = this.idFromUrl(url);
                return this.authorize(headers, null, () => { // Allow user to get their own, admin to get any
                    const currentAcc = this.currentAccount(headers);
                    if (!currentAcc) return this.unauthorized();

                    const request = this.appRequests.find(r => r.id === id);
                    if (!request) {
                        return this.error(`Request with id ${id} not found`, 404);
                    }

                    // Authorization check: Admin can see any, user can only see their own
                    if (currentAcc.role !== Role.Admin) {
                        const employee = this.employees.find(e => e.id === request.employeeId);
                        if (!employee || employee.userId !== currentAcc.id) {
                            return this.unauthorized("You are not authorized to view this request.");
                        }
                    }
                    return this.ok(request);
                });
            }


            default:
                // return next.handle(request); // If you have a real backend
                return throwError(() => new HttpErrorResponse({
                    status: 404, error: { message: `Fake backend: Route not found for ${method} ${url}` }
                }));
        }
    }

    // --- ACCOUNT MANAGEMENT METHODS ---
    private authenticate(body: any, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const { email, password } = body;
        const account = this.accounts.find(x => x.email === email);

        if (!account) return this.error('Invalid email or password.', 400);
        if (!account.isVerified) {
            setTimeout(() => {
                const verifyUrl = `${location.origin}/account/verify-email?token=${account.verificationToken}`;
                this.alertService.info(`<h4>Verification Email</h4><p>Please click the link to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>`, { autoClose: false });
            }, 1000);
            return this.error('Email is not yet verified. Please check your inbox.', 400);
        }
        if (account.password !== password) return this.error('Invalid email or password.', 400);
        if (account.status !== 'Active') return this.error('Account is inactive. Please contact support.', 400);

        account.refreshTokens = account.refreshTokens || [];
        account.refreshTokens.push(this.generateRefreshTokenForCookie());
        this.saveAccounts();

        const accountDetails = this.basicDetails(account);
        return this.ok({
            ...accountDetails,
            jwtToken: this.generateJwtToken(account)
        });
    }

    private refreshToken(body: any, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const requestRefreshTokenFromBody = body.refreshToken;
        const requestRefreshTokenFromCookie = this.getRefreshTokenFromCookie();
        const requestRefreshToken = requestRefreshTokenFromBody || requestRefreshTokenFromCookie;


        if (!requestRefreshToken) return this.unauthorized('Refresh token missing.');

        const account = this.accounts.find(x => x.refreshTokens && x.refreshTokens.includes(requestRefreshToken));
        if (!account) return this.unauthorized('Invalid or expired refresh token.');

        account.refreshTokens = account.refreshTokens.filter(x => x !== requestRefreshToken);
        account.refreshTokens.push(this.generateRefreshTokenForCookie());
        this.saveAccounts();

        return this.ok({
            ...this.basicDetails(account),
            jwtToken: this.generateJwtToken(account)
        });
    }

    private revokeToken(body: any, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const currentAcc = this.currentAccount(headers);
        if (!currentAcc) return this.unauthorized();

        const tokenToRevoke = body.token || this.getRefreshTokenFromCookie();
        const account = this.accounts.find(x => x.id === currentAcc.id);

        if (account && account.refreshTokens && tokenToRevoke) {
            account.refreshTokens = account.refreshTokens.filter(x => x !== tokenToRevoke);
            this.saveAccounts();
        }
        if (tokenToRevoke && tokenToRevoke === this.getRefreshTokenFromCookie()) {
            this.clearRefreshTokenCookie();
        }
        return this.ok({ message: 'Token revoked successfully.' });
    }

    private register(body: any): Observable<HttpEvent<any>> {
        const newAccountData = body as Partial<Account>;

        if (!newAccountData.email || !newAccountData.password) {
            return this.error('Email and password are required.', 400);
        }
        if (this.accounts.find(x => x.email === newAccountData.email)) {
            setTimeout(() => this.alertService.error(`Email '${newAccountData.email}' is already registered.`), 1000);
            return this.error(`Email '${newAccountData.email}' is already registered.`, 400);
        }

        const newAccount: Account = {
            id: this.newAccountId(),
            email: newAccountData.email,
            password: newAccountData.password,
            role: this.accounts.length === 0 ? Role.Admin : Role.User,
            firstName: newAccountData.firstName || '',
            lastName: newAccountData.lastName || '',
            title: newAccountData.title || '',
            status: this.accounts.length === 0 ? 'Active' : 'Inactive',
            dateCreated: new Date().toISOString(),
            verificationToken: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            isVerified: this.accounts.length === 0,
            refreshTokens: []
        };

        this.accounts.push(newAccount);
        this.saveAccounts();

        if (!newAccount.isVerified) {
            setTimeout(() => {
                const verifyUrl = `${location.origin}/account/verify-email?token=${newAccount.verificationToken}`;
                this.alertService.info(`<h4>Verification Email</h4><p>Thanks for registering! Please click the link to verify your email: <a href="${verifyUrl}">${verifyUrl}</a></p><div><strong>NOTE:</strong> This is a fake email.</div>`, { autoClose: false });
            }, 1000);
        }
        return this.ok({ message: 'Registration successful. Please check your email to verify your account if required.' }, 201);
    }

    private verifyEmail(body: any): Observable<HttpEvent<any>> {
        const { token } = body;
        if (!token) return this.error('Verification token is required.', 400);

        const account = this.accounts.find(x => x.verificationToken === token);
        if (!account) return this.error('Verification failed. Invalid or expired token.', 400);
        if (account.isVerified) return this.ok({ message: 'Email already verified.' });


        account.isVerified = true;
        account.status = 'Active';
        delete account.verificationToken;
        this.saveAccounts();
        return this.ok({ message: 'Email verified successfully. You can now login.' });
    }

    private forgotPassword(body: any): Observable<HttpEvent<any>> {
        const { email } = body;
        if (!email) return this.error('Email is required.', 400);

        const account = this.accounts.find(x => x.email === email);
        if (account) {
            account.resetToken = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
            account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            this.saveAccounts();
            setTimeout(() => {
                const resetUrl = `${location.origin}/account/reset-password?token=${account.resetToken}`;
                this.alertService.info(`<h4>Reset Password Email</h4><p>Please click the link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p><p>The link will be valid for 24 hours.</p><div><strong>NOTE:</strong> This is a fake email.</div>`, { autoClose: false });
            }, 1000);
        }
        return this.ok({ message: 'If your email address is registered, you will receive a password reset link.' });
    }

    private validateResetToken(body: any): Observable<HttpEvent<any>> {
        const { token } = body;
        if (!token) return this.error('Reset token is required.', 400);
        const account = this.accounts.find(x => x.resetToken === token && x.resetTokenExpires && new Date(x.resetTokenExpires) > new Date());
        return account ? this.ok({ message: 'Token is valid.' }) : this.error('Invalid or expired reset token.', 400);
    }

    private resetPassword(body: any): Observable<HttpEvent<any>> {
        const { token, password } = body;
        if (!token || !password) return this.error('Token and new password are required.', 400);

        const account = this.accounts.find(x => x.resetToken === token && x.resetTokenExpires && new Date(x.resetTokenExpires) > new Date());
        if (!account) return this.error('Invalid or expired reset token.', 400);

        account.password = password;
        account.isVerified = true;
        account.status = 'Active';
        delete account.resetToken;
        delete account.resetTokenExpires;
        this.saveAccounts();
        return this.ok({ message: 'Password has been reset successfully. You can now login.' });
    }

    private getAccounts(headers: HttpHeaders): Observable<HttpEvent<any>> {
        return this.authorize(headers, Role.Admin, () => {
            return this.ok(this.accounts.map(acc => this.basicDetails(acc)));
        });
    }

    private getAccountById(id: number, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const currentAcc = this.currentAccount(headers);
        if (!currentAcc) return this.unauthorized();

        const account = this.accounts.find(x => x.id === id);
        if (!account) return this.error('Account not found', 404);

        if (currentAcc.role !== Role.Admin && currentAcc.id !== account.id) {
            return this.unauthorized("You are not authorized to view this account.");
        }
        return this.ok(this.basicDetails(account));
    }

    private createAccount(body: any, headers: HttpHeaders): Observable<HttpEvent<any>> {
        return this.authorize(headers, Role.Admin, () => {
            const newAccountData = body as Partial<Account>;
            if (!newAccountData.email || !newAccountData.password || !newAccountData.role) {
                return this.error('Email, password, and role are required for new account creation.', 400);
            }
            if (this.accounts.find(x => x.email === newAccountData.email)) {
                return this.error(`Email '${newAccountData.email}' is already registered`, 400);
            }
            const newAccount: Account = {
                id: this.newAccountId(),
                email: newAccountData.email,
                password: newAccountData.password,
                role: newAccountData.role,
                firstName: newAccountData.firstName || '',
                lastName: newAccountData.lastName || '',
                title: newAccountData.title || '',
                dateCreated: new Date().toISOString(),
                isVerified: true,
                status: 'Active',
                refreshTokens: [],
                employeeId: newAccountData.employeeId
            };
            this.accounts.push(newAccount);
            this.saveAccounts();
            return this.ok(this.basicDetails(newAccount), 201);
        });
    }

    private updateAccount(id: number, body: any, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const currentAcc = this.currentAccount(headers);
        if (!currentAcc) return this.unauthorized();

        const accountIndex = this.accounts.findIndex(x => x.id === id);
        if (accountIndex === -1) return this.error('Account not found', 404);
        const accountToUpdate = this.accounts[accountIndex];

        if (currentAcc.role !== Role.Admin && currentAcc.id !== accountToUpdate.id) {
            return this.unauthorized("You are not authorized to update this account.");
        }

        const updateData = { ...body } as Partial<Account>;
        if (currentAcc.id === accountToUpdate.id && currentAcc.role !== Role.Admin && updateData.role && updateData.role !== accountToUpdate.role) {
            return this.error("You cannot change your own role.", 403);
        }

        if (updateData.password) {
            accountToUpdate.password = updateData.password;
        }
        ['firstName', 'lastName', 'title', 'email', 'role', 'status', 'employeeId'].forEach(field => {
            if (updateData[field] !== undefined) {
                accountToUpdate[field] = updateData[field];
            }
        });

        accountToUpdate.dateUpdated = new Date().toISOString();
        this.accounts[accountIndex] = accountToUpdate;
        this.saveAccounts();
        return this.ok(this.basicDetails(accountToUpdate));
    }

    private deleteAccount(id: number, headers: HttpHeaders): Observable<HttpEvent<any>> {
        const currentAcc = this.currentAccount(headers);
        if (!currentAcc) return this.unauthorized();

        const accountIndex = this.accounts.findIndex(x => x.id === id);
        if (accountIndex === -1) return this.error('Account not found', 404);

        const accountToDelete = this.accounts[accountIndex];
        if (currentAcc.role !== Role.Admin && currentAcc.id !== accountToDelete.id) {
            return this.unauthorized("You are not authorized to delete this account.");
        }
        if (accountToDelete.id === currentAcc.id && accountToDelete.role === Role.Admin && this.accounts.filter(a => a.role === Role.Admin).length <= 1) {
            return this.error("Cannot delete the last admin account.", 400);
        }

        this.accounts.splice(accountIndex, 1);
        this.saveAccounts();
        if (accountToDelete.id === currentAcc.id) {
            this.clearRefreshTokenCookie();
        }
        return this.ok({ message: 'Account deleted successfully.' });
    }

    // --- HELPER METHODS ---
    private ok(body?: any, status = 200): Observable<HttpResponse<any>> {
        return of(new HttpResponse({ status, body }));
    }

    private error(message: string, status = 400): Observable<HttpEvent<never>> {
        return throwError(() => new HttpErrorResponse({ error: { message }, status }));
    }

    private unauthorized(message = 'Unauthorized'): Observable<HttpEvent<never>> {
        return throwError(() => new HttpErrorResponse({ status: 401, error: { message } }));
    }

    private basicDetails(account: Account): Partial<Account> {
        const { id, title, firstName, lastName, email, role, dateCreated, dateUpdated, isVerified, status, employeeId } = account;
        return { id, title, firstName, lastName, email, role, dateCreated, dateUpdated, isVerified, status, employeeId };
    }

    private currentAccount(headers: HttpHeaders): Account | undefined {
        const authHeader = headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;

        const token = authHeader.substring(7);
        try {
            const payloadB64 = token.split('.')[1];
            if (!payloadB64) return undefined;

            const tokenPayload = JSON.parse(atob(payloadB64));
            if (Date.now() >= tokenPayload.exp * 1000) {
                console.warn("Fake backend: JWT token expired");
                this.clearRefreshTokenCookie();
                return undefined;
            }
            return this.accounts.find(x => x.id === tokenPayload.id);
        } catch (e) {
            console.error("Fake backend: Error parsing JWT token", e);
            return undefined;
        }
    }

    private authorize(headers: HttpHeaders, requiredRole: Role | string | null, successCallback: () => Observable<HttpEvent<any>>): Observable<HttpEvent<any>> {
        const account = this.currentAccount(headers);
        if (!account) {
            return this.unauthorized('Missing or invalid authentication token.');
        }
        if (requiredRole && account.role !== requiredRole) {
            return throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden - Insufficient permissions' } }));
        }
        return successCallback();
    }

    private idFromUrl(url: string): number {
        const match = url.match(/\/(\d+)$/);
        return match ? parseInt(match[1], 10) : -1;
    }

    private newAccountId(): number {
        return this.accounts.length ? Math.max(0, ...this.accounts.map(x => x.id)) + 1 : 1;
    }

    private saveAccounts(): void {
        localStorage.setItem(accountsKey, JSON.stringify(this.accounts));
    }

    private generateJwtToken(account: Account): string {
        const payload = {
            id: account.id,
            role: account.role,
            email: account.email,
            exp: Math.floor(new Date(Date.now() + 15 * 60 * 1000).getTime() / 1000),
        };
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const encodedPayload = btoa(JSON.stringify(payload));
        return `${header}.${encodedPayload}.fake-signature-for-demo-only`;
    }

    private generateRefreshTokenForCookie(): string {
        const token = `${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
        if (typeof document !== 'undefined') {
            document.cookie = `fakeRefreshToken=${token}; expires=${expires}; path=/; SameSite=Lax`;
        }
        return token;
    }

    private getRefreshTokenFromCookie(): string | undefined {
        if (typeof document === 'undefined') return undefined;
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'fakeRefreshToken') {
                return value;
            }
        }
        return undefined;
    }

    private clearRefreshTokenCookie(): void {
        if (typeof document !== 'undefined') {
            document.cookie = 'fakeRefreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
        }
    }
}

export const fakeBackendProvider = {
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};