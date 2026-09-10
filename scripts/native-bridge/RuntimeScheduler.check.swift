import RuntimeSchedulerRegression

// Compile the installed dependency through Swift's C++ importer, not a copied
// stand-in. This catches invalid return-ownership annotations on constructors.
func exerciseScheduler() {
  let scheduler = expo.RuntimeScheduler()
  precondition(!scheduler.supportsAsyncScheduling())
  var called = false
  scheduler.scheduleTask(expo.RuntimeScheduler.Priority.NormalPriority) {
    called = true
  }
  precondition(called)
}

for _ in 0..<1_000 { exerciseScheduler() }
print("Native bridge regression passed: shared-reference construction and synchronous dispatch")
