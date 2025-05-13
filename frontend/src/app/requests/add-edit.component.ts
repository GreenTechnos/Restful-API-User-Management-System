import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '@app/_services';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: 'add-edit.component.html'
})
export class RequestAddEditComponent implements OnInit {
  id: string;
  request: any = {
    type: 'Equipment',
    items: []
  };
  errorMessage: string;
  isAddMode: boolean;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountService: AccountService
  ) { }

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
    this.isAddMode = !this.id;

    if (!this.isAddMode) {
      // Load existing request for editing
      this.accountService.getRequestById(this.id)
        .pipe(first())
        .subscribe(
          request => this.request = request,
          error => this.errorMessage = error
        );
    }
  }

  addItem() {
    this.request.items.push({ name: '', quantity: 1 });
  }

  removeItem(index: number) {
    this.request.items.splice(index, 1);
  }

  save() {
    this.errorMessage = '';

    // Basic validation
    if (!this.request.type) {
      this.errorMessage = 'Type is required';
      return;
    }

    if (this.request.items.length === 0) {
      this.errorMessage = 'At least one item is required';
      return;
    }

    for (const item of this.request.items) {
      if (!item.name || !item.quantity) {
        this.errorMessage = 'All items must have a name and quantity';
        return;
      }
    }

    if (this.isAddMode) {
      this.createRequest();
    } else {
      this.updateRequest();
    }
  }

  private createRequest() {
    this.accountService.createRequest(this.request)
      .pipe(first())
      .subscribe(
        () => {
          this.router.navigate(['/requests'], {
            state: { message: 'Request created successfully' }
          });
        },
        error => {
          this.errorMessage = error.error?.message || error.message;
        }
      );
  }

  private updateRequest() {
    this.accountService.updateRequest(this.id, this.request)
      .pipe(first())
      .subscribe(
        () => {
          this.router.navigate(['/requests'], {
            state: { message: 'Request updated successfully' }
          });
        },
        error => {
          this.errorMessage = error.error?.message || error.message;
        }
      );
  }

  cancel() {
    this.router.navigate(['/requests']);
  }
}