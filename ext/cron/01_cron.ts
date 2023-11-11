// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

// @ts-ignore internal api
const core = Deno.core;

interface ScheduleOptions {
  minute?: string;
  hour?: string;
  day_of_month?: string;
  month?: string;
  day_of_week?: string;
}

function createCronSchedule(options: ScheduleOptions | string): string {
  if (typeof options == "string") {
    return options;
  }

  const { minute, hour, day_of_month, month, day_of_week } = options;

  return [
    minute || "*",
    hour || "*",
    day_of_month || "*",
    month || "*",
    day_of_week || "*",
  ].join(" ");
}

function cron(
  name: string,
  schedule: string | ScheduleOptions,
  handler: () => Promise<void> | void,
  options?: { backoffSchedule?: number[]; signal?: AbortSignal }
) {
  if (name === undefined) {
    throw new TypeError("Deno.cron requires a unique name");
  }
  if (schedule === undefined) {
    throw new TypeError("Deno.cron requires a valid schedule");
  }
  if (handler === undefined) {
    throw new TypeError("Deno.cron requires a handler");
  }

  let scheduleString = createCronSchedule(schedule);

  const rid = core.ops.op_cron_create(
    name,
    scheduleString,
    options?.backoffSchedule
  );

  if (options?.signal) {
    const signal = options?.signal;
    signal.addEventListener(
      "abort",
      () => {
        core.close(rid);
      },
      { once: true }
    );
  }

  return (async () => {
    let success = true;
    while (true) {
      const r = await core.opAsync("op_cron_next", rid, success);
      if (r === false) {
        break;
      }
      try {
        const result = handler();
        const _res = result instanceof Promise ? await result : result;
        success = true;
      } catch (error) {
        console.error(`Exception in cron handler ${name}`, error);
        success = false;
      }
    }
  })();
}

export { cron };
