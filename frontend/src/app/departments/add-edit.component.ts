import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';
import { first } from 'rxjs/operators';

@Component({ templateUrl: 'add-edit.component.html' })

export class AddEditDepartmentComponent implements OnInit {
    department: any = {
        name: '',
        description: ''
    };
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

        if (!this.isAddMode) {
            this.loading = true;
            this.accountService.getDepartmentById(this.id)
                .pipe(first())
                .subscribe({
                    next: (department) => {
                        this.department = department;
                        this.loading = false;
                    },
                    error: (error) => {
                        this.errorMessage = error;
                        this.loading = false;
                    }
                });
        }
    }

    save() {
        this.submitted = true;
        this.alertService.clear();

        if (this.loading) {
            return;
        }

        this.loading = true;
        if (this.isAddMode) {
            this.createDepartment();
        } else {
            this.updateDepartment();
        }
    }

    private createDepartment() {
        this.accountService.createDepartment(this.department)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Department created successfully', { keepAfterRouteChange: true });
                    this.router.navigate(['../'], { relativeTo: this.route });
                },
                error: (error) => {
                    this.errorMessage = error;
                    this.loading = false;
                }
            });
    }

    private updateDepartment() {
        this.accountService.updateDepartment(this.id, this.department)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Department updated successfully', { keepAfterRouteChange: true });
                    this.router.navigate(['../../'], { relativeTo: this.route });
                },
                error: (error) => {
                    this.errorMessage = error;
                    this.loading = false;
                }
            });
    }

    cancel() {
        this.router.navigate(['/departments']);
    }
}