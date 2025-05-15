import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '@app/_services';
import { first } from 'rxjs/operators';
import { AlertService } from '@app/_services';


@Component({
  selector: 'app-employee-transfer',
  templateUrl: './transfer.component.html'
})
export class TransferComponent implements OnInit {
  employee: any;
  departments: any[] = [];
  departmentId: number | null = null;
  alertService: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountService: AccountService
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.params['id'];

    // Load employee details
    this.accountService.getEmployeeById(id)
      .pipe(first())
      .subscribe(employee => {
        this.employee = employee;
        this.departmentId = employee.department?.id; // Set current department
      });

    // Load all departments
    this.accountService.getAllDepartments()
      .pipe(first())
      .subscribe(departments => this.departments = departments);
  }

  transfer() {
    if (!this.departmentId || !this.employee || this.employee.id === undefined) {
      console.error('Employee data or department ID is missing for transfer.');
      this.alertService.error('Cannot perform transfer: employee data is missing.'); // Add AlertService if not already used
      return;
    }

    // Ensure departmentId is a number if your service expects it
    const numericDepartmentId = typeof this.departmentId === 'string' ? parseInt(this.departmentId, 10) : this.departmentId;
    if (isNaN(numericDepartmentId)) {
      this.alertService.error('Invalid department selected.');
      return;
    }

    this.accountService.updateEmployee(this.employee.id, {
      departmentId: this.departmentId
    })
      .pipe(first())
      .subscribe(() => {
        this.router.navigate(['/employees'], {
          state: { message: 'Employee transferred successfully' }
        });
      });
  }

  cancel() {
    this.router.navigate(['/employees']);
  }
}