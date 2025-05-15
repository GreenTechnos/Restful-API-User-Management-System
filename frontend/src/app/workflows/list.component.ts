import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { WorkflowService, AlertService, AccountService, EmployeeService } from '@app/_services';
import { Account, Role } from '@app/_models';
import { WorkflowStatus, Workflow } from '@app/_models/workflow';
import { ConfirmModalComponent } from './confirm-modal.component';
import { Employee } from '@app/_models/employee';
import { HttpErrorResponse } from '@angular/common/http';

@Component({ templateUrl: 'list.component.html' })
export class ListWorkflowComponent implements OnInit, OnDestroy {
  @ViewChild('confirmModal') confirmModal!: ConfirmModalComponent;
  workflows: Workflow[] = [];
  loading = false;
  currentAccount: Account | null = null;
  isAdmin = false;
  employeeId: string | null = null;
  displayEmployeeId: string | null = null;
  confirmMessage: string = '';
  notFound = false;
  private pendingStatusChange: { id: string; status: WorkflowStatus } | null = null;
  employeeIdFromQuery: string | null = null;
  employeeDetails: Employee | null = null;

  private queryParamsSubscription!: Subscription;
  private statusUpdateWorkflow: Workflow | null = null;
  // Make enum available in template
  WorkflowStatus = WorkflowStatus;
  Role = Role;

  constructor(
    private workflowService: WorkflowService,
    private alertService: AlertService,
    private accountService: AccountService,
    private employeeService: EmployeeService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.currentAccount = this.accountService.accountValue;
    this.isAdmin = this.currentAccount?.role === Role.Admin;
  }
  private subscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit() {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.employeeIdFromQuery = params['employeeId'];
      this.workflows = [];
      this.employeeDetails = null;

      if (this.employeeIdFromQuery) {
        this.loadEmployeeDetails(this.employeeIdFromQuery);
        this.loadWorkflowsForEmployee(this.employeeIdFromQuery);
      } else if (this.isAdmin) {
        this.loadAllWorkflows();
      } else {

        const currentEmployeeId = this.employeeId;
        if (currentEmployeeId) {
          this.employeeIdFromQuery = String(currentEmployeeId);
          this.loadEmployeeDetails(String(currentEmployeeId));
          this.loadWorkflowsForEmployee(String(currentEmployeeId));
        } else {
          this.alertService.info("No employee specified, and your account is not linked to an employee record.");
          this.loading = false;
        }
      }
    });
  }

  loadEmployeeDetails(employeeId: string) {
    this.employeeService.getById(employeeId)
      .pipe(first())
      .subscribe({
        next: (employee) => this.employeeDetails = employee,
        error: (err) => this.alertService.error(this.formatError(err, 'Failed to load employee details'))
      });
  }

  loadWorkflowsForEmployee(employeeId: string) {
    this.loading = true;
    this.workflowService.getByEmployeeId(employeeId)
      .pipe(first())
      .subscribe({
        next: (workflows) => {
          this.workflows = this.sortWorkflows(workflows);
          this.loading = false;
        },
        error: (err) => {
          this.alertService.error(this.formatError(err, `Failed to load workflows for employee ${employeeId}`));
          this.workflows = [];
          this.loading = false;
        }
      });
  }

  loadAllWorkflows() {
    this.loading = true;
    this.workflowService.getAll()
      .pipe(first())
      .subscribe({
        next: (workflows) => {
          this.workflows = this.sortWorkflows(workflows);
          this.loading = false;
        },
        error: (err) => {
          this.alertService.error(this.formatError(err, 'Failed to load all workflows'));
          this.workflows = [];
          this.loading = false;
        }
      });
  }

  private sortWorkflows(workflows: Workflow[]): Workflow[] {
    return workflows.sort((a, b) => {
      const dateA = new Date(a.datetimecreated || 0).getTime();
      const dateB = new Date(b.datetimecreated || 0).getTime();
      return dateB - dateA;
    });
  }

  onStatusSelected(workflow: Workflow, newStatus: WorkflowStatus | string) {
    console.log(`Status change selected for workflow ${workflow.id} to ${newStatus}`);
    this.updateWorkflowStatus(workflow, newStatus as WorkflowStatus);
  }

  updateWorkflowStatus(workflow: Workflow, newStatus: WorkflowStatus) {
    if (!workflow || !workflow.id) return;
    this.workflowService.changeStatus(workflow.id, newStatus)
      .pipe(first())
      .subscribe({
        next: (updatedWorkflow) => {
          const index = this.workflows.findIndex(w => w.id === updatedWorkflow.id);
          if (index !== -1) {
            this.workflows[index] = { ...this.workflows[index], ...updatedWorkflow };
          }
          this.alertService.success('Workflow status updated successfully!');
        },
        error: (err) => {
          this.alertService.error(this.formatError(err, 'Failed to update workflow status'));
        }
      });
  }

  openStatusChangeModal(id: string, status: WorkflowStatus) {
    const workflow = this.workflows.find(x => x.id === id);
    if (!workflow) return;

    this.pendingStatusChange = { id, status };
    this.confirmMessage = `Are you sure you want to mark this workflow ${status === WorkflowStatus.ForReviewing ? 'for review' : 'as completed'}?`;
    this.confirmModal.show();
  }

  onStatusChangeConfirmed() {
    if (!this.pendingStatusChange) return;

    const { id, status } = this.pendingStatusChange;
    const workflow = this.workflows.find(x => x.id === id);
    if (!workflow) return;

    workflow.isUpdating = true;
    this.workflowService.changeStatus(id, status)
      .pipe(first())
      .subscribe({
        next: () => {
          workflow.status = status;
          workflow.isUpdating = false;
          this.alertService.success('Workflow status updated successfully');
        },
        error: error => {
          this.alertService.error(error);
          workflow.isUpdating = false;
        }
      });

    this.pendingStatusChange = null;
  }

  deleteWorkflow(id: string) {
    const workflow = this.workflows.find(x => x.id === id);
    if (!workflow) return;

    if (confirm('Are you sure you want to delete this workflow?')) {
      workflow.isDeleting = true;
      this.workflowService.delete(id)
        .pipe(first())
        .subscribe({
          next: () => {
            this.workflows = this.workflows.filter(x => x.id !== id);
            this.alertService.success('Workflow deleted successfully');
          },
          error: error => {
            this.alertService.error(error);
            workflow.isDeleting = false;
          }
        });
    }
  }

  getDetailsAsObject(details: any): { key: string, value: any }[] {
    return Object.entries(details || {}).map(([key, value]) => ({ key, value }));
  }

  isPendingOrReviewing(status: string): boolean {
    return status === WorkflowStatus.Pending || status === WorkflowStatus.ForReviewing;
  }

  isCompletedOrApproved(status: string): boolean {
    return status === WorkflowStatus.Completed || status === WorkflowStatus.Approved;
  }

  isRejected(status: string): boolean {
    return status === WorkflowStatus.Rejected;
  }

  canChangeStatus(status: string): boolean {
    return !(status === WorkflowStatus.Completed || status === WorkflowStatus.Rejected);
  }

  goBackToEmployees() {
    this.router.navigate(['/admin/employees']);
  }
  goBackToAdminDashboard() {
    this.router.navigate(['/admin']); // Or your main admin overview page
  }

  private formatError(error: HttpErrorResponse | Error, defaultMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || defaultMessage;
    }
    return error.message || defaultMessage;
  }
} 