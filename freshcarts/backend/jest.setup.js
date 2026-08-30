const { Logger } = require('@nestjs/common');

// Services log real operational events. Under test that output is noise that
// buries actual failures, so the Nest logger is muted for the whole run.
Logger.overrideLogger(false);
