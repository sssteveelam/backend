import { PickTaskListItemDto } from './pick-task-list-item.dto';

export type IssueLineDto = {
  id: string;
  issueId: string;
  productId: string;
  quantityBase: string;
  createdAt: string;
};

export type IssueDetailDto = {
  id: string;
  code: string;
  status: string;
  createdBy: string;
  createdAt: string;
  lines: IssueLineDto[];
  pickTasks?: PickTaskListItemDto[];
};
