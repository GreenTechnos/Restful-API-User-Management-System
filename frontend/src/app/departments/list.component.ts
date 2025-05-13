import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';
import { first } from 'rxjs/operators';

@Component({ templateUrl: 'list.component.html' })

export class DepartmentListComponent implements OnInit {
    departments: any[] = [];
    loading = false;

    constructor(
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.loadDepartments();
    }

    // Get current account info
    account() {
        return this.accountService.accountValue;
    }

    loadDepartments() {
        this.loading = true;
        this.accountService.getAllDepartments()
            .pipe(first())
            .subscribe({
                next: (departments) => {
                    this.departments = departments;
                    this.loading = false;
                },
                error: (error) => {
                    this.alertService.error(error);
                    this.loading = false;
                }
            });
    }

    add() {
        this.router.navigate(['/departments/add']);
    }

    edit(id: string) {
        this.router.navigate(['/departments/edit', id]);
    }

    delete(id: string) {
        if (confirm('Are you sure you want to delete this department?')) {
            this.loading = true;
            this.accountService.deleteDepartment(id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Department deleted successfully');
                        this.departments = this.departments.filter(x => x.id !== id);
                    },
                    error: (error) => {
                        this.alertService.error(error);
                        this.loading = false;
                    }
                });
        }
    }
}