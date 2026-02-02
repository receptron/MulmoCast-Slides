# Code Examples

<!-- Programming code samples -->

---

# TypeScript Example

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const getUser = async (id: number): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};
```

---

# Python Example

```python
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: str

async def get_user(user_id: int) -> User:
    response = await fetch(f"/api/users/{user_id}")
    return User(**response.json())
```

---

# Shell Script

```bash
#!/bin/bash

# Deploy script
yarn build
yarn test
yarn deploy --production
```
