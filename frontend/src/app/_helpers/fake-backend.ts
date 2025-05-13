import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpResponse,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HTTP_INTERCEPTORS,
    HttpErrorResponse // Import HttpErrorResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, mergeMap, materialize, dematerialize } from 'rxjs/operators';

// Define interfaces for your data structures for better type safety
interface User {
    id: number;
    email: string;
    password?: string; // Password should not be sent after auth
    role: string;
    employeeId: number; // Refers to Employee.id
    token?: string; // Will be added upon authentication
}

interface Employee {
    id: number;
    employeeId: string; // The 'EMP001' style ID
    userId: number; // Refers to User.id
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
}

interface AppRequest { // Renamed to avoid conflict with HttpRequest
    id: number;
    employeeId: number;
    type: string;
    requestItems: { name: string; quantity: number }[];
    status: string;
}

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    // Initial data
    private users: User[] = [
        { id: 1, email: 'admin@example.com', password: 'admin', role: 'Admin', employeeId: 1 },
        { id: 2, email: 'user@example.com', password: 'user', role: 'User', employeeId: 2 }
    ];
    private employees: Employee[] = [
        { id: 1, employeeId: 'EMP001', userId: 1, position: 'Developer', departmentId: 1, hireDate: '2025-01-01', status: 'Active' },
        { id: 2, employeeId: 'EMP002', userId: 2, position: 'Designer', departmentId: 2, hireDate: '2025-02-01', status: 'Active' }
    ];
    private departments: Department[] = [
        { id: 1, name: 'Engineering', description: 'Software development team', employeeCount: 1 },
        { id: 2, name: 'Marketing', description: 'Marketing team', employeeCount: 1 }
    ];
    private workflows: Workflow[] = [
        { id: 1, employeeId: 1, type: 'Onboarding', details: { task: 'Setup workstation' }, status: 'Pending' }
    ];
    private appRequests: AppRequest[] = [ // Renamed variable
        { id: 1, employeeId: 2, type: 'Equipment', requestItems: [{ name: 'Laptop', quantity: 1 }], status: 'Pending' }
    ];

    // ID Generators for new entities
    private nextUserId = this.users.length > 0 ? Math.max(...this.users.map(u => u.id)) + 1 : 1;
    private nextEmployeeId = this.employees.length > 0 ? Math.max(...this.employees.map(e => e.id)) + 1 : 1;
    private nextDepartmentId = this.departments.length > 0 ? Math.max(...this.departments.map(d => d.id)) + 1 : 1;
    private nextWorkflowId = this.workflows.length > 0 ? Math.max(...this.workflows.map(w => w.id)) + 1 : 1;
    private nextAppRequestId = this.appRequests.length > 0 ? Math.max(...this.appRequests.map(r => r.id)) + 1 : 1;


    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const { url, method, headers, body } = request;

        // Wrap in delayed observable to simulate server api call
        return of(null)
            .pipe(mergeMap(() => this.handleRoute(url, method, headers, body, next))) // Pass next for unhandled
            .pipe(materialize()) // Convert notifications to objects
            .pipe(delay(500))    // Simulate network latency
            .pipe(dematerialize()); // Convert back to notifications
    }

    private handleRoute(url: string, method: string, headers: any, body: any, next: HttpHandler): Observable<HttpEvent<any>> {
        // Accounts Routes
        if (url.endsWith('/accounts/authenticate') && method === 'POST') {
            const { email, password } = body;
            const user = this.users.find(u => u.email === email && u.password === password);
            if (!user) {
                return throwError(() => new HttpErrorResponse({ error: { message: 'Invalid credentials' }, status: 400 }));
            }
            // Return user details and a fake JWT token that includes user ID
            const userToReturn = { ...user };
            delete userToReturn.password; // Never return password
            userToReturn.token = `fake-jwt-token-id-${user.id}`; // User-specific token
            return of(new HttpResponse({ status: 200, body: userToReturn }));
        }

        // Changed to /users for clarity or stick to /accounts if you prefer
        if (url.endsWith('/users') && method === 'GET') {
            return this.authorize(headers, 'Admin', () => {
                const usersToReturn = this.users.map(u => {
                    const { password, ...userWithoutPassword } = u;
                    return userWithoutPassword;
                });
                return of(new HttpResponse({ status: 200, body: usersToReturn }));
            });
        }

        // Employees Routes
        if (url.endsWith('/employees') && method === 'GET') {
            return this.authorize(headers, null, () => of(new HttpResponse({ status: 200, body: this.employees })));
        }

        if (url.endsWith('/employees') && method === 'POST') {
            return this.authorize(headers, 'Admin', () => {
                const newEmployee: Employee = {
                    id: this.nextEmployeeId++,
                    ...body
                };
                this.employees.push(newEmployee);

                // Update department employee count
                const department = this.departments.find(d => d.id === newEmployee.departmentId);
                if (department) {
                    department.employeeCount++;
                }
                return of(new HttpResponse({ status: 201, body: newEmployee }));
            });
        }

        const employeeByIdMatch = url.match(/\/employees\/(\d+)$/);
        if (employeeByIdMatch && method === 'GET') {
            const id = parseInt(employeeByIdMatch[1]);
            return this.authorize(headers, null, () => {
                const employee = this.employees.find(e => e.id === id);
                return employee ?
                    of(new HttpResponse({ status: 200, body: employee })) :
                    throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Employee not found' } }));
            });
        }

        if (employeeByIdMatch && method === 'PUT') {
            const id = parseInt(employeeByIdMatch[1]);
            return this.authorize(headers, 'Admin', () => {
                const employeeIndex = this.employees.findIndex(e => e.id === id);
                if (employeeIndex === -1) {
                    return throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Employee not found' } }));
                }
                const oldEmployeeData = this.employees[employeeIndex];
                const updatedEmployee = { ...oldEmployeeData, ...body, id }; // Ensure ID is not overwritten

                // Check if departmentId changed for employeeCount update
                if (oldEmployeeData.departmentId !== updatedEmployee.departmentId) {
                    const oldDept = this.departments.find(d => d.id === oldEmployeeData.departmentId);
                    if (oldDept) oldDept.employeeCount--;

                    const newDept = this.departments.find(d => d.id === updatedEmployee.departmentId);
                    if (newDept) newDept.employeeCount++;
                }

                this.employees[employeeIndex] = updatedEmployee;
                return of(new HttpResponse({ status: 200, body: this.employees[employeeIndex] }));
            });
        }

        if (employeeByIdMatch && method === 'DELETE') {
            const id = parseInt(employeeByIdMatch[1]);
            return this.authorize(headers, 'Admin', () => {
                const employeeIndex = this.employees.findIndex(e => e.id === id);
                if (employeeIndex === -1) {
                    return throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Employee not found' } }));
                }
                const deletedEmployee = this.employees[employeeIndex];
                this.employees.splice(employeeIndex, 1);

                // Update department employee count
                const department = this.departments.find(d => d.id === deletedEmployee.departmentId);
                if (department) {
                    department.employeeCount--;
                }
                return of(new HttpResponse({ status: 200, body: { message: 'Employee deleted' } }));
            });
        }

        const employeeTransferMatch = url.match(/\/employees\/(\d+)\/transfer$/);
        if (employeeTransferMatch && method === 'POST') {
            const id = parseInt(employeeTransferMatch[1]); // Get ID from first capture group
            return this.authorize(headers, 'Admin', () => {
                const employee = this.employees.find(e => e.id === id);
                if (!employee) {
                    return throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Employee not found' } }));
                }

                const oldDepartmentId = employee.departmentId;
                const newDepartmentId = body.departmentId;

                if (oldDepartmentId !== newDepartmentId) {
                    const oldDept = this.departments.find(d => d.id === oldDepartmentId);
                    if (oldDept) oldDept.employeeCount--;

                    const newDept = this.departments.find(d => d.id === newDepartmentId);
                    if (newDept) newDept.employeeCount++;
                    else {
                        return throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Target department not found' } }));
                    }
                }

                employee.departmentId = newDepartmentId;
                this.workflows.push({
                    id: this.nextWorkflowId++,
                    employeeId: id,
                    type: 'Transfer',
                    details: body, // Contains new departmentId and potentially reason etc.
                    status: 'Pending'
                });
                return of(new HttpResponse({ status: 200, body: { message: 'Employee transferred successfully', employee } }));
            });
        }

        // Departments Routes
        if (url.endsWith('/departments') && method === 'GET') {
            return this.authorize(headers, null, () => of(new HttpResponse({ status: 200, body: this.departments })));
        }

        if (url.endsWith('/departments') && method === 'POST') {
            return this.authorize(headers, 'Admin', () => {
                const newDepartment: Department = {
                    id: this.nextDepartmentId++,
                    ...body,
                    employeeCount: 0 // New departments start with 0 employees
                };
                this.departments.push(newDepartment);
                return of(new HttpResponse({ status: 201, body: newDepartment }));
            });
        }

        const departmentByIdMatch = url.match(/\/departments\/(\d+)$/);
        if (departmentByIdMatch && method === 'PUT') {
            const id = parseInt(departmentByIdMatch[1]);
            return this.authorize(headers, 'Admin', () => {
                const deptIndex = this.departments.findIndex(d => d.id === id);
                if (deptIndex === -1) {
                    return throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Department not found' } }));
                }
                this.departments[deptIndex] = {
                    ...this.departments[deptIndex], // keep old values like employeeCount
                    ...body, // apply updates
                    id // ensure id is not changed
                };
                return of(new HttpResponse({ status: 200, body: this.departments[deptIndex] }));
            });
        }

        if (departmentByIdMatch && method === 'DELETE') {
            const id = parseInt(departmentByIdMatch[1]);
            return this.authorize(headers, 'Admin', () => {
                const department = this.departments.find(d => d.id === id);
                if (!department) {
                    return throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Department not found' } }));
                }
                if (department.employeeCount > 0) {
                    return throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Cannot delete department with active employees.' } }));
                }
                this.departments = this.departments.filter(d => d.id !== id);
                return of(new HttpResponse({ status: 200, body: { message: 'Department deleted' } }));
            });
        }

        // Workflows Routes
        const workflowByEmployeeIdMatch = url.match(/\/workflows\/employee\/(\d+)$/);
        if (workflowByEmployeeIdMatch && method === 'GET') {
            const employeeId = parseInt(workflowByEmployeeIdMatch[1]);
            return this.authorize(headers, null, () => {
                const employeeWorkflows = this.workflows.filter(w => w.employeeId === employeeId);
                return of(new HttpResponse({ status: 200, body: employeeWorkflows }));
            });
        }

        if (url.endsWith('/workflows') && method === 'POST') {
            return this.authorize(headers, 'Admin', () => { // Or maybe employee can create certain types?
                const newWorkflow: Workflow = {
                    id: this.nextWorkflowId++,
                    ...body
                };
                this.workflows.push(newWorkflow);
                return of(new HttpResponse({ status: 201, body: newWorkflow }));
            });
        }

        // AppRequests Routes
        if (url.endsWith('/requests') && method === 'GET') {
            // Original was 'Admin' only. Consider if regular users should see their own.
            return this.authorize(headers, 'Admin', () => of(new HttpResponse({ status: 200, body: this.appRequests })));
        }

        // If no route matched by the fake backend
        // return next.handle(request); // Use this if you want unhandled requests to go to a real backend
        return throwError(() => new HttpErrorResponse({ status: 404, error: { message: `Fake backend: Route not found for ${method} ${url}` } }));
    }

    private authorize(headers: any, requiredRole: string | null, successCallback: () => Observable<HttpEvent<any>>): Observable<HttpEvent<any>> {
        const user = this.getUserFromToken(headers); // Changed to a more token-based approach
        if (!user) {
            return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', error: { message: 'Missing or invalid authentication token.' } }));
        }
        if (requiredRole && user.role !== requiredRole) {
            return throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden', error: { message: 'You do not have permission to access this resource.' } }));
        }
        return successCallback();
    }

    private getUserFromToken(headers: any): User | null {
        const authHeader = headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.substring(7); // Remove 'Bearer '

        // Expecting token format: fake-jwt-token-id-${user.id}
        const tokenParts = token.split('-id-');
        if (tokenParts.length !== 2 || tokenParts[0] !== 'fake-jwt-token') {
            return null; // Invalid token format
        }

        const userId = parseInt(tokenParts[1], 10);
        if (isNaN(userId)) {
            return null; // Invalid user ID in token
        }

        const user = this.users.find(u => u.id === userId);
        if (!user) return null;

        // Return a copy without the password
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }
}

export const fakeBackendProvider = {
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};