FUNNEL_PERSONS_BY_STEP_SQL = """
SELECT person_id
FROM
({steps_per_person_query})
WHERE {persons_steps}
ORDER BY person_id
LIMIT 100
OFFSET {offset}
SETTINGS allow_experimental_window_functions = 1
"""

FUNNEL_INNER_EVENT_STEPS_QUERY = """
SELECT 
person_id,
timestamp,
{steps}
{select_prop}
FROM 
({event_query})
WHERE ({steps_condition})
{extra_conditions}
"""
