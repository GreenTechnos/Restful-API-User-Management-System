// src/app/requests/add-edit.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { first, switchMap, catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { RequestService } from '@app/_services/request.service';
import { EmployeeService } from '@app/_services/employee.service';
import { AlertService } from '@app/_services/alert.service';
import { WorkflowService } from '@app/_services/workflow.service';
import { AccountService } from '@app/_services/account.service';
import { Account, Role } from '@app/_models';
import { AppRequest } from '@app/_helpers';
import { Workflow, WorkflowStatus, WorkflowType } from '@app/_models/workflow';
import { Employee } from '@app/_models/employee';


export interface EmployeeForDropdown {
  id: number;
  employeeId: string;
  userId?: number;
}


@Component({
  templateUrl: 'add-edit.component.html',
})
export class RequestAddEditComponent implements OnInit {
  form!: FormGroup;
  id: string | null = null;
  isAddMode!: boolean;
  loading = false;
  submitted = false;
  currentAccount: Account | null;

  employeesForDropdown: EmployeeForDropdown[] = []; // For the employee dropdown

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private requestService: RequestService,
    private employeeService: EmployeeService,
    private workflowService: WorkflowService, // Injected
    private alertService: AlertService,
    private accountService: AccountService    // Injected
  ) {
    this.currentAccount = this.accountService.accountValue; // Initialize currentAccount
  }

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
    this.isAddMode = !this.id;

    this.form = this.formBuilder.group({
      type: ['Equipment', Validators.required],
      // Pre-fill employeeId if adding and current user has an employeeId, otherwise null
      employeeId: [this.isAddMode ? (this.currentAccount?.id || null) : null, Validators.required],
      requestItems: this.formBuilder.array([], [Validators.required, Validators.minLength(1)]) // Ensure at least one item
    });

    this.loadEmployeesForDropdown();

    if (!this.isAddMode && this.id) {
      this.loadRequestData();
    } else {
      // For add mode, add one default item if desired (or leave empty for user to add)
      if (this.requestItems.length === 0) { // Add item only if array is empty
        this.addItem();
      }
    }

    // If in add mode and current user is NOT an admin AND their employeeId is set, disable the field.
    // This means non-admins can only create requests for themselves.
    if (this.isAddMode && this.currentAccount?.role !== Role.Admin && this.f.employeeId.value) {
      this.f.employeeId.disable();
    }
  }

  // Convenience getters
  get f(): { [key: string]: AbstractControl } { return this.form.controls; }
  get requestItems(): FormArray { return this.form.get('requestItems') as FormArray; }

  loadEmployeesForDropdown() {
    this.employeeService.getAll()
      .pipe(first())
      .subscribe({
        next: (employees: Employee[]) => { // Expect full Employee objects from service
          this.employeesForDropdown = employees.map(emp => {
            // Attempt to get linked account for full name
            // This assumes EmployeeService.getAll() returns Employee objects that might
            // have a userId to link to an Account, or AccountService can fetch by userId.
            // Or, your Employee model might already include firstName/lastName.
            const linkedAccount = this.accountService.getAccountByUserId(Number(emp.id)); // You'll need this helper
            return {
              id: Number(emp.id), // Ensure id is a number
              employeeId: emp.employeeId, // Display ID like "EMP001"
              userId: Number(emp.id) // Ensure userId is a number
            };
          });

          // If in add mode, not an admin, and current user has an employeeId, try to preselect and disable.
          if (this.isAddMode && this.currentAccount?.role !== Role.Admin && this.currentAccount?.id) {
            const currentEmpForDropdown = this.employeesForDropdown.find(e => e.id === Number(this.currentAccount?.id));
            if (currentEmpForDropdown) {
              this.form.patchValue({ employeeId: currentEmpForDropdown.id });
              this.f.employeeId.disable();
            }
          }
        },
        error: (err: HttpErrorResponse) => {
          this.alertService.error(this.formatError(err, 'Failed to load employees for dropdown'));
        }
      });
  }

  loadRequestData() {
    if (!this.id) return;
    this.loading = true;
    this.requestService.getById(this.id)
      .pipe(first())
      .subscribe(
        (request: any) => { // Accept any, then cast to AppRequest
          const appRequest = request as AppRequest;
          this.form.patchValue({
            type: appRequest.type,
            employeeId: appRequest.employeeId // This should be the Employee.id
          });
          this.requestItems.clear();
          appRequest.requestItems.forEach((item: { name: string, quantity: number }) => {
            this.requestItems.push(this.createItemFormGroup(item.name, item.quantity));
          });
          this.loading = false;

          // If editing and current user is not an admin, disable employeeId field
          // (assuming they can only edit requests they created or are assigned to them in some way)
          if (this.currentAccount?.role !== Role.Admin && appRequest.employeeId !== Number(this.currentAccount?.id)) {
            this.f.employeeId.disable(); // Or other logic based on who can edit what
          } else if (this.currentAccount?.role !== Role.Admin) {
            this.f.employeeId.disable(); // If non-admin can only edit their own, and it is their own
          }
        },
        (err: HttpErrorResponse) => {
          this.alertService.error(this.formatError(err, 'Failed to load request data'));
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
      this.form.markAllAsTouched(); // Show errors on all fields
      if (this.requestItems.length === 0) { // Specific check for FormArray
        this.alertService.error('At least one item is required.');
      }
      return;
    }

    if (this.loading) return;
    this.loading = true;

    // Use getRawValue() to include values from disabled controls (like employeeId for non-admins)
    const formValue = this.form.getRawValue();
    const requestData: AppRequest = {
      type: formValue.type,
      employeeId: Number(formValue.employeeId), // Ensure employeeId is a number
      requestItems: formValue.requestItems,
      status: 'Pending Approval' // Initial status when creating
    };

    if (this.isAddMode) {
      this.createRequestWithWorkflow(requestData);
    } else if (this.id) {
      // If updating, also pass the original request ID for the service
      this.updateRequest(this.id, requestData);
    }
  }

  private createRequestWithWorkflow(requestData: AppRequest) {
    this.requestService.create(requestData).pipe(
      first(),
      switchMap((createdRequest: AppRequest) => {
        if (!createdRequest || createdRequest.id === undefined || createdRequest.employeeId === null || createdRequest.employeeId === undefined) {
          // If request creation failed or didn't return expected data, throw an error to be caught by catchError
          return throwError(() => new Error('Request creation failed or did not return an ID. Cannot create workflow.'));
        }

        // Get details of the employee who made the request for the workflow details
        const employeeWhoMadeRequest = this.employeesForDropdown.find(e => e.id === createdRequest.employeeId);
        const requesterName = employeeWhoMadeRequest
          ? `${employeeWhoMadeRequest.employeeId}`
          : `Employee ID ${createdRequest.employeeId}`;

        const itemsSummary = createdRequest.requestItems.map(it => `${it.name} (x${it.quantity})`).join(', ');

        // --- !!! IMPORTANT: Determine Approver Logic !!! ---
        // This is a placeholder. You need logic to find the correct approver's Employee ID.
        // It could be based on department, role, a predefined matrix, or a default Admin.
        // For this example, let's assume an Admin (employeeId 1) needs to approve.
        const approverEmployeeId = 1; // <<< --- REPLACE WITH YOUR ACTUAL APPROVER LOGIC
        if (!this.employeesForDropdown.find(e => e.id === approverEmployeeId)) {
          console.warn(`Approver with employeeId ${approverEmployeeId} not found in dropdown list. Workflow might be unassigned or assigned incorrectly.`);
        }

        const workflowData: Partial<Workflow> = {
          employeeId: approverEmployeeId, // ID of the employee who needs to ACTION this workflow
          type: WorkflowType.RequestApproval,
          details: {
            task: `Request from ${requesterName} - Review ${createdRequest.type} request #${createdRequest.id} for items: ${itemsSummary}.`,
          },
          status: WorkflowStatus.Pending, // From your WorkflowStatus enum
          originatingRequestId: createdRequest.id,
        };
        return this.workflowService.create(workflowData);
      }),
      catchError(err => {
        this.alertService.error(this.formatError(err, 'Failed to submit request or create approval workflow.'));
        this.loading = false;
        return of(null); // Completes the observable chain gracefully after an error
      })
    )
      .subscribe({
        next: (workflow) => {
          if (workflow) { // Check if workflow creation was successful (not caught by catchError)
            this.alertService.success('Request submitted and approval workflow created!', { keepAfterRouteChange: true });
            this.router.navigate(['/admin/requests']); // Adjust path to your requests list
          }
          // Loading is set to false in catchError or here
          this.loading = false;
        },
        // error is handled by catchError, no separate error handler needed here for the main subscription
        complete: () => { // Ensure loading is false if observable completes without error but also without next
          if (this.loading) { this.loading = false; }
        }
      });
  }

  private updateRequest(id: string, requestData: AppRequest) {
    // If updating a request also needs workflow changes (e.g., re-approval), add logic here.
    // For now, this just updates the request itself. The workflow would be separate.
    this.requestService.update(id, requestData)
      .pipe(first())
      .subscribe({
        next: () => {
          this.alertService.success('Request updated successfully', { keepAfterRouteChange: true });
          this.router.navigate(['/admin/requests']); // Adjust path
        },
        error: (err: HttpErrorResponse) => {
          this.alertService.error(this.formatError(err, 'Failed to update request'));
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  onCancel() {
    // Navigate based on add/edit mode to go "back" appropriately
    if (this.isAddMode) {
      this.router.navigate(['../'], { relativeTo: this.route }); // If /admin/requests/add -> /admin/requests
    } else {
      this.router.navigate(['../../'], { relativeTo: this.route }); // If /admin/requests/edit/1 -> /admin/requests
    }
    // Or a fixed path: this.router.navigate(['/admin/requests']);
  }

  private formatError(error: HttpErrorResponse | Error, defaultMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || defaultMessage;
    }
    return error.message || defaultMessage;
  }
}