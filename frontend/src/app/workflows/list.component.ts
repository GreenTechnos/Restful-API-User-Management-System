import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from '@app/_services';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: 'list.component.html'
})
export class WorkflowsComponent implements OnInit {
  employeeId: string;
  workflows: any[] = [];
  account = this.accountService.accountValue;

  constructor(
    private route: ActivatedRoute,
    private accountService: AccountService
  ) { }

  ngOnInit() {
    this.employeeId = this.route.snapshot.params['id'];
    this.loadWorkflows();
  }

  private loadWorkflows() {
    this.accountService.getEmployeeWorkflows(this.employeeId)
      .pipe(first())
      .subscribe(
        workflows => {
          this.workflows = workflows;
          // Initialize status for each workflow if not present
          this.workflows.forEach(w => w.status = w.status || 'Pending');
        },
        error => console.error('Failed to load workflows', error)
      );
  }

  updateStatus(workflow: any) {
    if (!workflow.id || !workflow.status) return;

    this.accountService.updateWorkflowStatus(workflow.id, { status: workflow.status })
      .pipe(first())
      .subscribe(
        () => {
          // Optional: Show success message
          console.log('Workflow status updated successfully');
        },
        error => {
          console.error('Failed to update workflow status', error);
          // Revert the status change in UI if update fails
          this.loadWorkflows(); // Reload to ensure consistency
        }
      );
  }
}