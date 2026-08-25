/** One model-facing timing and token-budget decision for invoking the workflow tool. */
export interface WorkflowDeliveryChoiceScenario {
  id: string;
  prompt: string;
  expectedWait: boolean;
  expectedTokenBudget: number | null;
}

/** Pure scoring result for one captured workflow tool invocation. */
export interface WorkflowDeliveryChoiceEvaluation {
  passed: boolean;
  resolvedWait: boolean | null;
  resolvedTokenBudget: number | null;
  assertions: Array<{ name: string; passed: boolean; details: string }>;
}

/** Focused #89 scenarios for delivery timing and opt-in token budgets. */
export const WORKFLOW_DELIVERY_CHOICE_SCENARIOS: readonly WorkflowDeliveryChoiceScenario[] = [
  {
    id: "background-delivery",
    prompt:
      "Run a workflow to audit the repository from several independent angles. I do not need the result in this turn; let it be delivered back later so I can keep working.",
    expectedWait: false,
    expectedTokenBudget: null,
  },
  {
    id: "inline-result",
    prompt:
      "Run a workflow to compare the two proposed designs, then use its result in your answer in this same turn. I am waiting for the result before you respond.",
    expectedWait: true,
    expectedTokenBudget: null,
  },
  {
    id: "explicit-token-budget",
    prompt:
      "Run a workflow to audit the repository from several independent angles. Cap the run at exactly 200,000 tokens and let the result be delivered back later.",
    expectedWait: false,
    expectedTokenBudget: 200_000,
  },
];

/** Score captured workflow arguments without executing the submitted workflow. */
export function evaluateWorkflowDeliveryChoice(
  scenario: WorkflowDeliveryChoiceScenario,
  value: unknown,
): WorkflowDeliveryChoiceEvaluation {
  const input = isRecord(value) ? value : null;
  const hasScript = typeof input?.script === "string" && input.script.trim().length > 0;
  const hasName = typeof input?.name === "string" && input.name.trim().length > 0;
  const hasWorkflow = hasScript || hasName;
  const validWait = input !== null && (input.wait === undefined || typeof input.wait === "boolean");
  const resolvedWait = validWait ? input.wait === true : null;
  const validTokenBudget =
    input !== null &&
    (input.tokenBudget === undefined ||
      (typeof input.tokenBudget === "number" && Number.isFinite(input.tokenBudget) && input.tokenBudget > 0));
  const resolvedTokenBudget = validTokenBudget && typeof input.tokenBudget === "number" ? input.tokenBudget : null;
  const timingMatches = resolvedWait === scenario.expectedWait;
  const tokenBudgetMatches = validTokenBudget && resolvedTokenBudget === scenario.expectedTokenBudget;
  const assertions = [
    {
      name: "workflow:called-with-script-or-name",
      passed: hasWorkflow,
      details: "the model must invoke the workflow tool with a nonblank script or saved/built-in name",
    },
    {
      name: "wait:valid-type",
      passed: validWait,
      details: "wait must be omitted for its false default or supplied as a boolean",
    },
    {
      name: "wait:matches-user-timing",
      passed: timingMatches,
      details: scenario.expectedWait
        ? "same-turn use should pass wait: true"
        : "later delivery should omit wait and use the default background run",
    },
    {
      name: "tokenBudget:valid-positive-number",
      passed: validTokenBudget,
      details: "tokenBudget must be omitted or supplied as a positive finite number",
    },
    {
      name: "tokenBudget:matches-user-intent",
      passed: tokenBudgetMatches,
      details:
        scenario.expectedTokenBudget === null
          ? "ordinary workflow requests should omit tokenBudget"
          : `the user-supplied cap must be preserved exactly (${scenario.expectedTokenBudget})`,
    },
  ];
  return {
    passed: assertions.every(({ passed }) => passed),
    resolvedWait,
    resolvedTokenBudget,
    assertions,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
