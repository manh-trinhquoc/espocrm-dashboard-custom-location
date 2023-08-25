## Overview

- Cho phép hiển thị dashboard ở 1 số vị trí tùy chỉnh: VD: entity list view

## Triển khai

1. Tạo view custom có add thêm phần kanban
2. Phần kanban tham khảo view home
3. Tạo thêm view admin cấu hình ở trong entity cho phép đè lên phần views của clientDefs/ENTITY.json  

- View này dạng tickbox list: đè list, đè detail..
- Khi user tick chọn đè, check nếu đã có giá trị khác không phải view custom của mình thì hiện cảnh báo
- Lưu giá trị trước khi đè, nếu user bỏ tick thì revert lại giá trị cũ
