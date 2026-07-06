import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SavePriestResult = {
  person_id?: string
  clergy_profile_id?: string
  slug?: string
  internal_reference_code?: string
}

function cleanText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const { data, error } = await supabase.rpc('admin_save_priest', { payload })

    if (error) {
      console.error('Failed to save priest transactionally', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const result = data as SavePriestResult
    const priestType = cleanText(payload.priest_type) ?? (cleanText(payload.religious_institute_name) || cleanText(payload.religious_order) ? 'religious' : 'diocesan')
    const religiousInstituteName = cleanText(payload.religious_institute_name) ?? cleanText(payload.religious_order)
    const religiousProvinceName = cleanText(payload.religious_province_name)
    const religiousHouseEntityId = cleanText(payload.religious_house_entity_id)

    if (result.clergy_profile_id || result.person_id) {
      let query = supabase
        .from('clergy_profiles')
        .update({
          priest_type: priestType,
          religious_institute_name: religiousInstituteName,
          religious_province_name: religiousProvinceName,
          religious_house_entity_id: religiousHouseEntityId,
        })

      query = result.clergy_profile_id
        ? query.eq('id', result.clergy_profile_id)
        : query.eq('person_id', result.person_id as string)

      const { error: profileError } = await query
      if (profileError) {
        console.error('Failed to update priest type fields', profileError)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected priest admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el sacerdote' }, { status: 500 })
  }
}
