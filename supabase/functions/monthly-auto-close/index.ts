import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date()
    if (today.getDate() < 5) {
      return new Response(
        JSON.stringify({ message: 'Ainda não é dia 5' }),
        { status: 200 }
      )
    }

    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const monthStr = lastMonth.toISOString().slice(0, 10)

    const { data: isClosed } = await supabase.rpc('is_month_closed', {
      p_month: monthStr
    })

    if (isClosed) {
      return new Response(
        JSON.stringify({ message: `${monthStr} já fechado` }),
        { status: 200 }
      )
    }

    const { data, error } = await supabase.rpc('close_month', {
      p_month: monthStr,
      p_salesperson_id: null
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        message: `${monthStr} fechado automaticamente`,
        closures: data
      }),
      { status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
