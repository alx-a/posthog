from typing import Type

from ee.clickhouse.queries.funnels.base import ClickhouseFunnelBase
from ee.clickhouse.queries.funnels.funnel import ClickhouseFunnel
from posthog.models.filters.filter import Filter
from posthog.models.team import Team


class ClickhouseFunnelTimeToConvert(ClickhouseFunnelBase):
    def __init__(
        self, filter: Filter, team: Team, funnel_order_class: Type[ClickhouseFunnelBase] = ClickhouseFunnel
    ) -> None:
        super().__init__(filter, team)
        self.funnel_order = funnel_order_class(filter, team)

    def _format_results(self, results: list) -> list:
        return results

    def get_query(self) -> str:
        steps_per_person_query = self.funnel_order.get_step_counts_query()
        self.params.update(self.funnel_order.params)
        # expects 1 person per row, whatever their max step is, and the step conversion times for this person

        # Conversion to which step (from the immediately preceding one) should be calculated
        to_step = self._filter.funnel_to_step

        # Use custom bin_count if provided by user, otherwise infer an automatic one based on the number of samples
        bin_count = self._filter.bin_count
        if bin_count is not None:
            # Custom count is clamped between 1 and 90
            if bin_count < 1:
                bin_count = 1
            elif bin_count > 90:
                bin_count = 90
            bin_count_identifier = str(bin_count)
            bin_count_expression = None
        else:
            # Auto count is clamped between 3 and 60
            bin_count_identifier = "bin_count"
            bin_count_expression = f"""
                count() AS sample_count,
                least(60, greatest(3, ceil(cbrt(sample_count)))) AS {bin_count_identifier},
            """

        if not (0 < to_step < len(self._filter.entities)):
            raise ValueError(
                f'Filter parameter funnel_to_step can only be one of {", ".join(map(str, range(1, len(self._filter.entities))))} for time to convert!'
            )

        query = f"""
            WITH
                step_runs AS (
                    {steps_per_person_query}
                ),
                histogram_params AS (
                    -- Binning ensures that each sample belongs to a bin in results
                    -- If bin_count is not a custom number, it's calculated in bin_count_expression
                    SELECT
                        floor(min(step_{to_step}_average_conversion_time)) AS from_seconds,
                        ceil(max(step_{to_step}_average_conversion_time)) AS to_seconds,
                        {bin_count_expression or ""}
                        ceil((to_seconds - from_seconds) / {bin_count_identifier}) AS bin_width_seconds
                    FROM step_runs
                ),
                -- Below CTEs make histogram_params columns available to the query below as straightforward identifiers
                ( SELECT bin_width_seconds FROM histogram_params ) AS bin_width_seconds,
                -- bin_count is only made available as an identifier if it had to be calculated
                {
                    f"( SELECT {bin_count_identifier} FROM histogram_params ) AS {bin_count_identifier},"
                    if bin_count_expression else ""
                }
                ( SELECT from_seconds FROM histogram_params ) AS histogram_from_seconds,
                ( SELECT to_seconds FROM histogram_params ) AS histogram_to_seconds
            SELECT
                bin_to_seconds,
                person_count
            FROM (
                -- Calculating bins from step runs
                SELECT
                    histogram_from_seconds + floor((step_{to_step}_average_conversion_time - histogram_from_seconds) / bin_width_seconds) * bin_width_seconds AS bin_to_seconds,
                    count() AS person_count
                FROM step_runs
                WHERE step_{to_step}_average_conversion_time IS NOT NULL
                GROUP BY bin_to_seconds
            ) results
            FULL OUTER JOIN (
                -- Making sure bin_count bins are returned
                -- Those not present in the results query due to lack of data simply get person_count 0
                SELECT histogram_from_seconds + number * bin_width_seconds AS bin_to_seconds FROM system.numbers LIMIT {bin_count_identifier} + 1
            ) fill
            USING (bin_to_seconds)
            ORDER BY bin_to_seconds
            SETTINGS allow_experimental_window_functions = 1"""

        return query
