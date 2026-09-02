create temporary table baseline_sources(
  source_key text primary key,
  title text not null,
  document_type text not null,
  issuing_authority text,
  document_date date,
  external_url text not null,
  description text
) on commit drop;

insert into baseline_sources values
('ced_2026','Mensaje de la Conferencia del Episcopado Dominicano - 27 de febrero de 2026','pastoral_document','Conferencia del Episcopado Dominicano','2026-02-27','https://ced.org.do/backoffice/wp-content/uploads/2026/02/Mensaje-CED-27-de-febrero-2026-1.pdf','Fuente primaria para la existencia vigente de las circunscripciones territoriales dominicanas.'),
('vatican_stella_2025','Erección de la Diócesis de Stella Maris','official_bulletin','Sala Stampa della Santa Sede','2025-08-27','https://press.vatican.va/content/salastampa/it/bollettino/pubblico/2025/08/27/0594/01028.html','Fuente primaria: erección de Stella Maris y dependencia metropolitana de Santo Domingo.'),
('vatican_military_2017','Nombramiento del Ordinario Militar para la República Dominicana','official_bulletin','Sala Stampa della Santa Sede','2017-01-02','https://press.vatican.va/content/salastampa/es/bollettino/pubblico/2017/01/02/otros.html','Fuente primaria que confirma la vigencia del Ordinariato Militar de la República Dominicana.'),
('ch_current_2026','Current Dioceses in Dominican Republic','other','Catholic-Hierarchy.org',null,'https://www.catholic-hierarchy.org/country/ddo2.html','Fuente secundaria de contraste para el inventario vigente de 13 circunscripciones.'),
('ch_structure_2026','Structured View of Dioceses in Central America - Dominican Republic','other','Catholic-Hierarchy.org',null,'https://catholic-hierarchy.org/diocese/qview2.html','Fuente secundaria de contraste para las dos provincias eclesiásticas y sus sufragáneas.');

insert into public.documents(title,document_type,issuing_authority,document_date,external_url,description,visibility,status)
select s.title,s.document_type,s.issuing_authority,s.document_date,s.external_url,s.description,'public','approved'
from baseline_sources s
where not exists(select 1 from public.documents d where d.external_url=s.external_url);

create temporary table baseline_jurisdictions(
  slug text primary key,
  type_key text not null,
  name text not null,
  erected_at date,
  account_valid_from date,
  account_code text not null unique,
  source_key text not null,
  source_name text not null,
  source_url text not null,
  coverage_kind text not null
) on commit drop;

insert into baseline_jurisdictions values
('provincia-eclesiastica-santo-domingo','ecclesiastical_province','Provincia Eclesiástica de Santo Domingo','1953-09-25','1953-09-25','JUR-DO-PROV-SANTO-DOMINGO','ch_structure_2026','Catholic-Hierarchy.org','https://catholic-hierarchy.org/diocese/qview2.html','partial'),
('provincia-eclesiastica-santiago-de-los-caballeros','ecclesiastical_province','Provincia Eclesiástica de Santiago de los Caballeros','1994-02-14','1994-02-14','JUR-DO-PROV-SANTIAGO','ch_structure_2026','Catholic-Hierarchy.org','https://catholic-hierarchy.org/diocese/qview2.html','partial'),
('arquidiocesis-santo-domingo','archdiocese','Arquidiócesis de Santo Domingo','1511-08-08','1546-02-12','JUR-DO-ARCH-SANTO-DOMINGO','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dsndo.html','partial'),
('arquidiocesis-santiago-de-los-caballeros','archdiocese','Arquidiócesis de Santiago de los Caballeros','1953-09-25','1994-02-14','JUR-DO-ARCH-SANTIAGO','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dsnca.html','partial'),
('diocesis-bani','diocese','Diócesis de Baní','1986-11-08','1986-11-08','JUR-DO-DIO-BANI','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dbani.html','partial'),
('diocesis-barahona','diocese','Diócesis de Barahona','1976-04-24','1976-04-24','JUR-DO-DIO-BARAHONA','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dbara.html','partial'),
('diocesis-la-vega','diocese','Diócesis de La Vega','1953-09-25','1953-09-25','JUR-DO-DIO-LA-VEGA','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dlave.html','partial'),
('diocesis-mao-montecristi','diocese','Diócesis de Mao-Montecristi','1978-01-16','1978-01-16','JUR-DO-DIO-MAO-MONTECRISTI','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dmaom.html','partial'),
('diocesis-nuestra-senora-de-la-altagracia-higuey','diocese','Diócesis de Nuestra Señora de la Altagracia en Higüey','1959-04-01','1959-04-01','JUR-DO-DIO-HIGUEY','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dnuse.html','partial'),
('diocesis-puerto-plata','diocese','Diócesis de Puerto Plata','1996-12-16','1996-12-16','JUR-DO-DIO-PUERTO-PLATA','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dpupl.html','partial'),
('diocesis-san-francisco-de-macoris','diocese','Diócesis de San Francisco de Macorís','1978-01-16','1978-01-16','JUR-DO-DIO-SAN-FRANCISCO-MACORIS','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dsnfm.html','partial'),
('diocesis-san-juan-de-la-maguana','diocese','Diócesis de San Juan de la Maguana','1953-09-25','1969-11-19','JUR-DO-DIO-SAN-JUAN-MAGUANA','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dsjdr.html','partial'),
('diocesis-san-pedro-de-macoris','diocese','Diócesis de San Pedro de Macorís','1997-02-01','1997-02-01','JUR-DO-DIO-SAN-PEDRO-MACORIS','ced_2026','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dsnpm.html','partial'),
('diocesis-stella-maris','diocese','Diócesis de Stella Maris','2025-08-27','2025-08-27','JUR-DO-DIO-STELLA-MARIS','vatican_stella_2025','Sala Stampa della Santa Sede','https://press.vatican.va/content/salastampa/it/bollettino/pubblico/2025/08/27/0594/01028.html','partial'),
('ordinariato-militar-republica-dominicana','military_ordinariate','Ordinariato Militar de la República Dominicana','1958-01-23','1958-01-23','JUR-DO-MILITARY','vatican_military_2017','Catholic-Hierarchy.org','https://www.catholic-hierarchy.org/diocese/dmldo.html','specialized');

insert into public.ecclesiastical_entities(entity_type_id,name,official_name,slug,country,country_iso2,status,visibility,erected_at,source_name,source_url,source_checked_at)
select et.id,s.name,s.name,s.slug,'República Dominicana','DO','active','public',s.erected_at,s.source_name,s.source_url,current_date
from baseline_jurisdictions s
join public.entity_types et on et.key=s.type_key and et.status='active'
on conflict(slug) do update set
  entity_type_id=excluded.entity_type_id,
  name=excluded.name,
  official_name=excluded.official_name,
  country=excluded.country,
  country_iso2=excluded.country_iso2,
  status='active',
  visibility='public',
  erected_at=coalesce(public.ecclesiastical_entities.erected_at,excluded.erected_at),
  source_name=excluded.source_name,
  source_url=excluded.source_url,
  source_checked_at=current_date,
  updated_at=now();

insert into public.jurisdiction_accounts(ecclesiastical_entity_id,account_code,canonical_status,sort_order,valid_from,is_current,status,visibility,source_document_id,notes)
select e.id,s.account_code,'active',coalesce(et.default_level_order,100),s.account_valid_from,true,'active','public',d.id,
       'Línea base documental de jurisdicciones de República Dominicana. Carga 2026-09-02; no infiere país como padre canónico.'
from baseline_jurisdictions s
join public.ecclesiastical_entities e on e.slug=s.slug
join public.entity_types et on et.id=e.entity_type_id
join baseline_sources bs on bs.source_key=s.source_key
join public.documents d on d.external_url=bs.external_url
on conflict(ecclesiastical_entity_id) do update set
  account_code=excluded.account_code,
  canonical_status='active',
  valid_from=excluded.valid_from,
  valid_to=null,
  is_current=true,
  status='active',
  visibility='public',
  source_document_id=excluded.source_document_id,
  notes=excluded.notes,
  updated_at=now();

create temporary table baseline_edges(
  parent_code text not null,
  child_code text not null,
  relationship_type text not null,
  valid_from date not null,
  source_key text not null,
  primary key(parent_code,child_code,relationship_type)
) on commit drop;

insert into baseline_edges values
('JUR-HOLY-SEE','JUR-DO-PROV-SANTO-DOMINGO','contains','1953-09-25','ch_structure_2026'),
('JUR-HOLY-SEE','JUR-DO-PROV-SANTIAGO','contains','1994-02-14','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-ARCH-SANTO-DOMINGO','metropolitan_see','1953-09-25','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-BANI','suffragan_of','1986-11-08','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-BARAHONA','suffragan_of','1976-04-24','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-HIGUEY','suffragan_of','1959-04-01','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-SAN-JUAN-MAGUANA','suffragan_of','1969-11-19','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-SAN-PEDRO-MACORIS','suffragan_of','1997-02-01','ch_structure_2026'),
('JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-STELLA-MARIS','suffragan_of','2025-08-27','vatican_stella_2025'),
('JUR-DO-PROV-SANTIAGO','JUR-DO-ARCH-SANTIAGO','metropolitan_see','1994-02-14','ch_structure_2026'),
('JUR-DO-PROV-SANTIAGO','JUR-DO-DIO-LA-VEGA','suffragan_of','1994-02-14','ch_structure_2026'),
('JUR-DO-PROV-SANTIAGO','JUR-DO-DIO-MAO-MONTECRISTI','suffragan_of','1994-02-14','ch_structure_2026'),
('JUR-DO-PROV-SANTIAGO','JUR-DO-DIO-PUERTO-PLATA','suffragan_of','1996-12-16','ch_structure_2026'),
('JUR-DO-PROV-SANTIAGO','JUR-DO-DIO-SAN-FRANCISCO-MACORIS','suffragan_of','1994-02-14','ch_structure_2026'),
('JUR-HOLY-SEE','JUR-DO-MILITARY','specialized_jurisdiction','1958-01-23','vatican_military_2017');

insert into public.jurisdiction_account_edges(parent_account_id,child_account_id,relationship_type,valid_from,is_current,status,visibility,source_document_id,notes)
select p.id,c.id,b.relationship_type,b.valid_from,true,'active','public',d.id,
       'Dependencia canónica documentada en la línea base RD 2026-09-02.'
from baseline_edges b
join public.jurisdiction_accounts p on p.account_code=b.parent_code
join public.jurisdiction_accounts c on c.account_code=b.child_code
join baseline_sources bs on bs.source_key=b.source_key
join public.documents d on d.external_url=bs.external_url
where not exists(
  select 1 from public.jurisdiction_account_edges x
  where x.parent_account_id=p.id and x.child_account_id=c.id and x.relationship_type=b.relationship_type and x.is_current=true and x.status='active'
);

insert into public.entity_relationships(parent_entity_id,child_entity_id,relationship_type,start_date,is_current,document_id,status,notes)
select pe.id,ce.id,b.relationship_type,b.valid_from,true,d.id,'active',
       'Proyección de compatibilidad del árbol jurisdiccional canónico RD.'
from baseline_edges b
join public.jurisdiction_accounts pa on pa.account_code=b.parent_code
join public.jurisdiction_accounts ca on ca.account_code=b.child_code
join public.ecclesiastical_entities pe on pe.id=pa.ecclesiastical_entity_id
join public.ecclesiastical_entities ce on ce.id=ca.ecclesiastical_entity_id
join baseline_sources bs on bs.source_key=b.source_key
join public.documents d on d.external_url=bs.external_url
where not exists(
  select 1 from public.entity_relationships x
  where x.parent_entity_id=pe.id and x.child_entity_id=ce.id and x.relationship_type=b.relationship_type and x.is_current=true and x.status='active'
);

insert into public.jurisdiction_geographic_coverages(jurisdiction_id,country_iso2,coverage_kind,coverage_percentage,valid_from,is_current,status,visibility,source_document_id,notes)
select e.id,'DO',s.coverage_kind,null,s.account_valid_from,true,'active','public',d.id,
       case when s.coverage_kind='specialized' then 'Jurisdicción especializada vinculada a República Dominicana; el país no es su padre canónico.' else 'Cobertura vigente en República Dominicana; no se afirma porcentaje ni frontera civil detallada.' end
from baseline_jurisdictions s
join public.ecclesiastical_entities e on e.slug=s.slug
join baseline_sources bs on bs.source_key=s.source_key
join public.documents d on d.external_url=bs.external_url
where not exists(
  select 1 from public.jurisdiction_geographic_coverages g
  where g.jurisdiction_id=e.id and g.country_iso2='DO' and g.coverage_kind=s.coverage_kind and g.is_current=true and g.status='active'
);

create or replace view public.public_dioceses
with (security_invoker=true)
as
select ee.id,
    et.key as entity_type_key,
    et.name as entity_type_name,
    ee.name,
    ee.official_name,
    ee.slug,
    ee.description,
    ee.latin_name,
    ee.cathedral_name,
    add_honorific_to_semicolon_list(ee.current_ordinary_name, 'Mons.'::text) as current_ordinary_name,
    ee.current_ordinary_title,
    ee.territory_summary,
    ee.area_km2,
    ee.statistics_year,
    ee.population_total,
    ee.catholics_total,
    ee.catholics_percent,
    ee.parishes_count,
    ee.source_name,
    ee.source_url,
    ee.source_checked_at,
    coalesce(c.name,ee.country) as country,
    ee.province,
    ee.municipality,
    ee.address,
    ee.email,
    ee.phone,
    ee.website,
    ee.facebook_url,
    ee.instagram_url,
    ee.youtube_url,
    ee.erected_at,
    case when parent_type.key='ecclesiastical_province' then parent.name else null end as ecclesiastical_province_name,
    case when parent_type.key='ecclesiastical_province' then parent.slug else null end as ecclesiastical_province_slug,
    er.relationship_type,
    ee.created_at,
    ee.updated_at,
    ee.country_iso2,
    c.name as country_name
from public.ecclesiastical_entities ee
join public.entity_types et on et.id=ee.entity_type_id
left join public.countries c on c.iso2=ee.country_iso2
left join public.entity_relationships er on er.child_entity_id=ee.id and er.is_current=true and er.status='active'
left join public.ecclesiastical_entities parent on parent.id=er.parent_entity_id
left join public.entity_types parent_type on parent_type.id=parent.entity_type_id
where et.key in ('archdiocese','diocese','military_ordinariate')
  and ee.visibility='public' and ee.status='active'
  and (parent.id is null or parent_type.key in ('ecclesiastical_province','country','holy_see'));

insert into public.audit_logs(action,target_table,target_id,old_data,new_data,scope_type,country_iso2,outcome)
values('jurisdiction.baseline.import','jurisdiction_accounts',null,null,
       jsonb_build_object('country_iso2','DO','baseline_date','2026-09-02','expected_current_accounts_including_holy_see',16,'expected_current_edges',15,'sources',jsonb_build_array('CED 2026','Santa Sede 2025 Stella Maris','Santa Sede 2017 Ordinariato Militar','Catholic-Hierarchy current/structured cross-check')),
       'national','DO','success');

do $$
declare
  v_accounts int;
  v_edges int;
  v_coverages int;
  v_public_dioceses int;
  v_military int;
begin
  select count(*) into v_accounts from public.jurisdiction_accounts where is_current=true and status='active';
  if v_accounts <> 16 then raise exception 'baseline current account count %, expected 16',v_accounts; end if;

  select count(*) into v_edges from public.jurisdiction_account_edges where is_current=true and status='active';
  if v_edges <> 15 then raise exception 'baseline current edge count %, expected 15',v_edges; end if;

  select count(*) into v_coverages from public.jurisdiction_geographic_coverages g join public.ecclesiastical_entities e on e.id=g.jurisdiction_id where g.country_iso2='DO' and g.is_current=true and g.status='active' and e.status='active';
  if v_coverages <> 15 then raise exception 'baseline DO coverage count %, expected 15',v_coverages; end if;

  select count(*) into v_public_dioceses from public.public_dioceses where country_iso2='DO';
  if v_public_dioceses <> 13 then raise exception 'public diocese count %, expected 13',v_public_dioceses; end if;

  select count(*) into v_military from public.public_dioceses where slug='ordinariato-militar-republica-dominicana';
  if v_military <> 1 then raise exception 'military ordinariate missing from public projection'; end if;

  if exists(select 1 from public.jurisdiction_accounts ja join public.ecclesiastical_entities e on e.id=ja.ecclesiastical_entity_id where ja.is_current=true and (e.source_url='https://example.org/fuente-datos-ficticios' or e.source_name in ('SINEP Seed Integral','SINEP Seed QA'))) then
    raise exception 'fabricated current jurisdiction data returned';
  end if;
end $$;
