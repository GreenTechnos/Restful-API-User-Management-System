import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';

@Component({
    templateUrl: 'add-edit.component.html'
})
export class AddEditEmployeeComponent implements OnInit {
    employee: any = {
        employeeId: '',
        userId: null,
        position: '',
        departmentId: null,
        hireDate: null,
        status: 'Active'
    };
    users: any[] = [];
    departments: any[] = [];
    id: string;
    isAddMode: boolean;
    errorMessage: string = '';
    loading = false;
    submitted = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];
        this.isAddMode = !this.id;

        // Load users and departments
        this.loadUsers();
        this.loadDepartments();

        if (!this.isAddMode) {
            this.loadEmployee();
        }
    }

    loadUsers() {
        console.log('Attempting to load users...');
        this.accountService.getAllUsers()
            .pipe(first())
            .subscribe({
                next: users => {
                    console.log('Users successfully loaded:', users);
                    this.users = users;
                },
                error: err => {
                    console.error('Error loading users in AddEditEmployeeComponent:', err);
                    this.alertService.error(err.error?.message || err.message || 'Failed to load users for dropdown');
                }
            });
    }

    loadDepartments() {
        this.accountService.getAllDepartments()
            .pipe(first())
            .subscribe(departments => this.departments = departments);
    }

    loadEmployee() {
        this.loading = true;
        this.accountService.getEmployeeById(this.id)
            .pipe(first())
            .subscribe({
                next: (employee) => {
                    this.employee = employee;
                    this.loading = false;
                },
                error: (error) => {
                    this.errorMessage = error;
                    this.loading = false;
                }
            });
    }

    save() {
        this.submitted = true;
        this.alertService.clear();

        if (this.loading) {
            return;
        }

        this.loading = true;
        if (this.isAddMode) {
            this.createEmployee();
        } else {
            this.updateEmployee();
        }
    }

    private createEmployee() {
        this.accountService.createEmployee(this.employee)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Employee created successfully', { keepAfterRouteChange: true });
                    this.router.navigate(['../'], { relativeTo: this.route });
                },
                error: (error) => {
                    this.errorMessage = error;
                    this.loading = false;
                }
            });
    }

    private updateEmployee() {
        this.accountService.updateEmployee(this.id, this.employee)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Employee updated successfully', { keepAfterRouteChange: true });
                    this.router.navigate(['../../'], { relativeTo: this.route });
                },
                error: (error) => {
                    this.errorMessage = error;
                    this.loading = false;
                }
            });
    }

    cancel() {
        this.router.navigate(['/employees']);
    }
}