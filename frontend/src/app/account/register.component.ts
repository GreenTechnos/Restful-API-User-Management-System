import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';

// Add this interface at the top of the file
interface RegisterResponse {
    message?: string;
    [key: string]: any;
}

@Component({ templateUrl: 'register.component.html' })
export class RegisterComponent implements OnInit {
    form: UntypedFormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: UntypedFormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.form = this.formBuilder.group({
            title: ['', Validators.required],
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', Validators.required],
            acceptTerms: [false, Validators.requiredTrue]
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.form.invalid) {
            return;
        }

        this.loading = true;
        this.accountService.register(this.form.value)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    console.log('Registration response:', response);
                    this.loading = false;
                    
                    // Explicitly show the success message
                    if (response && response.message) {
                        // For admin registration, first show success message with high priority
                        if (response.message.includes('Admin')) {
                            // Show success message first with higher priority/order
                            this.alertService.success(response.message, { 
                                keepAfterRouteChange: true, 
                                autoClose: false,
                                priority: 10 // Higher priority to display at top
                            });
                            
                            // Then show the info message with lower priority
                            setTimeout(() => {
                                // We'll let the fake backend handle this
                                // The delay ensures the success message appears first
                            }, 100);
                            
                            // Delay navigation to allow seeing both messages
                            setTimeout(() => {
                                this.router.navigate(['../login'], { relativeTo: this.route });
                            }, 5000);
                        } else {
                            this.alertService.success(response.message, { keepAfterRouteChange: true });
                            setTimeout(() => {
                                this.router.navigate(['../login'], { relativeTo: this.route });
                            }, 3000);
                        }
                    } else {
                        this.alertService.success('Registration successful', { keepAfterRouteChange: true });
                        setTimeout(() => {
                            this.router.navigate(['../login'], { relativeTo: this.route });
                        }, 3000);
                    }
                },
                error: error => {
                    this.alertService.error(error);
                    this.loading = false;
                }
            });
    }
}