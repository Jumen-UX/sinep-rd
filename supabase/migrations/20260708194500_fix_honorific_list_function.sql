create or replace function public.add_honorific_to_semicolon_list(value text, prefix text)
returns text
language sql
immutable
as $$
  select case
    when value is null or btrim(value) = '' then value
    else (
      select string_agg(
        case
          when lower(btrim(parts.item)) = 'vacante' or lower(btrim(parts.item)) like 'sede vacante%' then parts.item
          when lower(btrim(parts.item)) like lower(btrim(prefix)) || '%' then parts.item
          else btrim(prefix) || ' ' || parts.item
        end,
        '; ' order by parts.ordinality
      )
      from (
        select btrim(raw_item) as item, ordinality
        from unnest(string_to_array(value, ';')) with ordinality as semicolon_items(raw_item, ordinality)
        where btrim(raw_item) <> ''
      ) as parts
    )
  end
$$;
