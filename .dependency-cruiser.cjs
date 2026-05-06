module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make refactoring and navigation harder.",
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: "no-client-to-server",
      severity: "error",
      from: {
        path: "^client/src"
      },
      to: {
        path: "^server/src"
      }
    },
    {
      name: "no-server-to-client",
      severity: "error",
      from: {
        path: "^server/src"
      },
      to: {
        path: "^client/src"
      }
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules"
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"]
    }
  }
};