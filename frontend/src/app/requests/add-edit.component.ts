// src/app/requests/add-edit.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { first } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

// Assuming you'll have dedicated services
import { RequestService } from '@app/_services/request.service'; // Create this service
import { EmployeeService } from '@app/_services/employee.service'; // Create or use existing
import { AlertService } from '@app/_services/alert.service';

import { AppRequest, EmployeeForDropdown } from '../_helpers/fake-backend'; // Adjust path to your models

@Component({
  templateUrl: 'add-edit.component.html',
  // Add styleUrls if needed
})
export class RequestAddEditComponent implements OnInit {
  form!: FormGroup;
  id: string | null = null;
  isAddMode!: boolean;
  loading = false;
  submitted = false;

  employees: EmployeeForDropdown[] = []; // For the employee dropdown

  // For dynamic items, request.items will be managed by a FormArray

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private requestService: RequestService,     // Use RequestService
    private employeeService: EmployeeService,   // Use EmployeeService
    private alertService: AlertService
  ) { }

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
    this.isAddMode = !this.id;

    // Initialize the form structure
    this.form = this.formBuilder.group({
      type: ['Equipment', Validators.required], // Default to 'Equipment'
      employeeId: [null, Validators.required],  // Employee ID
      requestItems: this.formBuilder.array([], Validators.required) // Array for items
    });

    this.loadEmployeesForDropdown(); // Load employees for the dropdown

    if (!this.isAddMode && this.id) {
      this.loadRequestData();
    } else {
      // For add mode, add one default item if desired
      this.addItem();
    }
  }

  // Convenience getter for easy access to form fields in template
  get f(): { [key: string]: AbstractControl } { return this.form.controls; }
  // Convenience getter for requestItems FormArray
  get requestItems(): FormArray {
    return this.form.get('requestItems') as FormArray;
  }

  loadEmployeesForDropdown() {
    this.employeeService.getAll() // Assuming getAll returns a list of employees
      .pipe(first())
      .subscribe({
        next: (employees) => {
          // Map to a simpler structure if needed, or use employees directly if they have id and a display name
          this.employees = employees.map(emp => ({
            id: Number(emp.id), // Convert ID to number
            employeeId: emp.employeeId // The display ID like "EMP001"
          }));
        },
        error: (err: HttpErrorResponse) => {
          this.alertService.error(err.error?.message || err.message || 'Failed to load employees');
        }
      });
  }

  loadRequestData() {
    if (!this.id) return;
    this.loading = true;
    this.requestService.getById(this.id) // Use RequestService
      .pipe(first())
      .subscribe(
        (request: any) => {
          this.form.patchValue({
            type: request.type,
            employeeId: request.employeeId
          });
          // Clear existing items and populate with fetched items
          this.requestItems.clear();
          request.requestItems.forEach((item: any) => {
            this.requestItems.push(this.createItemFormGroup(item.name, item.quantity));
          });
          this.loading = false;
        },
        (err: HttpErrorResponse) => {
          this.alertService.error(err.error?.message || err.message || 'Failed to load request');
          this.loading = false;
        }
      );
  }

  createItemFormGroup(name: string = '', quantity: number = 1): FormGroup {
    return this.formBuilder.group({
      name: [name, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]]
    });
  }

  addItem() {
    this.requestItems.push(this.createItemFormGroup());
  }

  removeItem(index: number) {
    this.requestItems.removeAt(index);
  }

  onSubmit() {
    this.submitted = true;
    this.alertService.clear();

    if (this.form.invalid) {
      // Mark all fields as touched to show validation errors
      this.form.markAllAsTouched();
      // If requestItems is empty after trying to submit, show specific error
      if (this.requestItems.length === 0 && this.form.get('requestItems')?.hasError('required')) {
        this.alertService.error('At least one item is required.');
      }
      return;
    }

    if (this.loading) return;

    this.loading = true;
    const requestData: AppRequest = this.form.value as AppRequest;

    if (this.isAddMode) {
      this.createRequest(requestData);
    } else if (this.id) {
      this.updateRequest(this.id, requestData);
    }
  }

  private createRequest(requestData: AppRequest) {
    this.requestService.create(requestData) // Use RequestService
      .pipe(first())
      .subscribe({
        next: () => {
          this.alertService.success('Request created successfully', { keepAfterRouteChange: true });
          this.router.navigate(['/admin/requests']); // Adjust path as needed
        },
        error: (err: HttpErrorResponse) => {
          this.alertService.error(err.error?.message || err.message || 'Failed to create request');
          this.loading = false;
        }
      });
  }

  private updateRequest(id: string, requestData: AppRequest) {
    this.requestService.update(id, requestData) // Use RequestService
      .pipe(first())
      .subscribe({
        next: () => {
          this.alertService.success('Request updated successfully', { keepAfterRouteChange: true });
          this.router.navigate(['/admin/requests']); // Adjust path as needed
        },
        error: (err: HttpErrorResponse) => {
          this.alertService.error(err.error?.message || err.message || 'Failed to update request');
          this.loading = false;
        }
      });
  }

  onCancel() {
    this.router.navigate(['/admin/requests']); // Adjust path as needed
  }
}