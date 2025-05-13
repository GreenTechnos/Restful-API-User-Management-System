import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '@app/_services';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: '/list.component.html'
})
export class RequestListComponent implements OnInit {
  requests: any[] = [];
  account = this.accountService.accountValue;

  constructor(
    private router: Router,
    private accountService: AccountService
  ) { }

  ngOnInit() {
    this.loadAllRequests();
  }

  private loadAllRequests() {
    this.accountService.getAllRequests()
      .pipe(first())
      .subscribe(
        requests => this.requests = requests,
        error => console.error('Error loading requests:', error)
      );
  }

  add() {
    this.router.navigate(['/requests/add']);
  }

  edit(id: string) {
    this.router.navigate(['/requests/edit', id]);
  }

  delete(id: string) {
    if (confirm('Are you sure you want to delete this request?')) {
      this.accountService.deleteRequest(id)
        .pipe(first())
        .subscribe({
          next: () => {
            this.requests = this.requests.filter(x => x.id !== id);
          },
          error: error => {
            console.error('Error deleting request:', error);
          }
        });
    }
  }
}