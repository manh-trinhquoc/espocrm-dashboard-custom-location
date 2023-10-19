## Overview

- Cho phép hiển thị dashboard ở 1 số vị trí tùy chỉnh: VD: entity list view

## Triển khai

- tạo list view custom có thêm phần dashboard. Người dùng sẽ custom clientDefs/ENTITY.json để load list view này:
```json
    "views": {
        "list": "dashboard-custom-location:views/record/list"
    }
```
- nếu user tạo tab list có tên entity + '-list', ví dụ 'lead-list' thì sẽ tự động nhảy vào dashboard vở list view tương ứng.
- Tham khảo 
    - home.js

## Triển khai dự kiến v0.0.2

1. Tạo thêm view admin cấu hình ở trong entity cho phép đè lên phần views của clientDefs/ENTITY.json  

- View này dạng tickbox list: đè list, đè detail..
- Khi user tick chọn đè, check nếu đã có giá trị khác không phải view custom của mình thì hiện cảnh báo
- Lưu giá trị trước khi đè, nếu user bỏ tick thì revert lại giá trị cũ
