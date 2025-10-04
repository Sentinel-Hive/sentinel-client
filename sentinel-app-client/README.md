## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Development Workflow

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This will start Vite in development mode and launch the Tauri app.

### Validate your project

We have a `validate` script that ensures code consistency and catches errors before build. It will:

1. Format your code with Prettier
2. Run ESLint
3. Build the project

Run:

```bash
npm run validate
```

This ensures your code is formatted, linted, and builds cleanly.

### Building for release

We use Tauri’s bundler to package the app into an executable.  
Run the release script:

```bash
npm run release
```

This will:

- Format and lint the code
- Run the build
- Package the app into native installers

On Windows, you’ll get `.exe`/`.msi` installers.  
On Linux, you’ll get `.AppImage` and `.deb` packages.  
These are located in `src-tauri/target/release/bundle/`.

For cross-platform builds (Windows and Linux together), use the provided GitHub Actions workflow in `.github/workflows/tauri-release.yml`.

## Code Quality

### Prettier

Prettier is configured for consistent formatting.  
To format your codebase:

```bash
npm run format
```

To check formatting without writing changes:

```bash
npm run format:check
```

### ESLint

ESLint is configured to catch potential issues in JS/TS/React code.  
To run linting:

```bash
npm run lint
```

To automatically fix issues:

```bash
npm run lint:fix
```

### Validate Script

As mentioned above, `npm run validate` ties these together into one step.

## Application Structure

- **src/components/**  
  Contains reusable React components like `Header`, `AlertCard`, and `AlertNotification`.

- **src/pages/**  
  Contains top-level pages such as `Analytics`, `Datasets`, and `Alerts`.

- **src-tauri/**  
  Contains Rust code and configuration for Tauri.
    - `tauri.conf.json` defines app settings such as name, version, and bundling info.
    - `target/` contains Rust build artifacts and final packaged binaries.

## Pages and Components

### Pages

- **Analytics Page** (`src/pages/Analytics.tsx`)  
  Entry point for data visualization and analysis. Intended to host charts, graphs, and metrics.

- **Datasets Page** (`src/pages/Datasets.tsx`)  
  Used to display and manage datasets that power your analytics and alerting workflows.

- **Alerts Page** (`src/pages/Alerts.tsx`)  
  Displays a feed of alerts using `AlertCard` components. This is where acknowledged and unacknowledged alerts are managed.

### Components

- **Header** (`src/components/Header.tsx`)  
  Top navigation bar. Includes links to Analytics, Datasets, and Alerts pages. Contains a refresh button, a profile dropdown, and a notifications dropdown that can display recent `AlertNotification` items.

- **AlertCard** (`src/components/AlertCard.tsx`)  
  Displays a single alert with severity, title, source, timestamp, optional description, tags, and an acknowledgment button.

- **AlertNotification** (`src/components/AlertNotification.tsx`)  
  A compact version of an alert used in dropdown notifications. Shows severity, time since creation, and a truncated description.

## Packaging and Distribution

- Local: run `npm run release` on your OS to produce installers for that OS.
- CI/CD: push a tag (e.g., `v0.1.0`) to GitHub and the workflow will build installers for both Linux and Windows, uploading them as artifacts.

## Summary

- Use `npm run dev` for development.
- Use `npm run validate` to format, lint, and build before committing.
- Use `npm run release` to package into executables for distribution.
