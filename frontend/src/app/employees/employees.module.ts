import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LayoutComponent } from './layout.component';
import { ListComponent } from './list.component';
import { AddEditEmployeeComponent } from './add-edit.component';
import { TransferComponent } from './transfer.component';

const routes = [
    {
        path: '', component: LayoutComponent,
        children: [
            { path: '', component: ListComponent },
            { path: 'add', component: AddEditEmployeeComponent },
            { path: 'edit/:id', component: AddEditEmployeeComponent },
            { path: 'transfer/:id', component: TransferComponent }
        ]
    }
];

@NgModule({
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        RouterModule.forChild(routes)
    ],
    declarations: [
        TransferComponent,
        LayoutComponent,
        ListComponent,
        AddEditEmployeeComponent
    ]
})
export class EmployeesModule { } 