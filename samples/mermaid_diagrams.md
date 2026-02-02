# System Architecture

<!-- Architecture overview with diagrams -->

---

# User Authentication Flow

This diagram shows how users authenticate.

```mermaid
flowchart TD
    A[User] --> B[Login Page]
    B --> C{Valid Credentials?}
    C -->|Yes| D[Generate Token]
    C -->|No| E[Show Error]
    D --> F[Redirect to Dashboard]
    E --> B
```

---

# Database Schema

Entity relationship diagram.

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created_at
        int user_id FK
    }
```

---

# Deployment Pipeline

CI/CD workflow.

```mermaid
flowchart LR
    A[Push Code] --> B[Run Tests]
    B --> C[Build]
    C --> D[Deploy Staging]
    D --> E{Approve?}
    E -->|Yes| F[Deploy Production]
    E -->|No| G[Rollback]
```
