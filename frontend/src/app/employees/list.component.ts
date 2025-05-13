import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '@app/_services';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: 'list.component.html' // assuming the template is in list.component.html
})
export class ListComponent implements OnInit {
  employees: any[] = [];
  account = this.accountService.accountValue;

  constructor(
    private router: Router,
    private accountService: AccountService
  ) { }

  ngOnInit() {
    this.loadAllEmployees();
  }

  private loadAllEmployees() {
    this.accountService.getAllUsers()
      .pipe(first())
      .subscribe(employees => this.employees = employees);
  }

  viewRequests(id: string) {
    this.router.navigate(['/employees/requests', id]);
  }

  viewWorkflows(id: string) {
    this.router.navigate(['/employees/workflows', id]);
  }

  transfer(id: string) {
    this.router.navigate(['/employees/transfer', id]);
  }

  edit(id: string) {
    this.router.navigate(['/employees/edit', id]);
  }

  delete(id: string) {
    if (confirm('Are you sure you want to delete this employee?')) {
      this.accountService.deleteEmployee(id)
        .pipe(first())
        .subscribe(() => this.employees = this.employees.filter(x => x.id !== id));
    }
  }

  add() {
    this.router.navigate(['/employees/add']);
  }
}