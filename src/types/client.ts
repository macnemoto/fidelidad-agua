export type MovementAction = 'created' | 'purchase_registered' | 'progress_updated' | 'profile_updated' | 'reward_redeemed'

export interface Client {
  id: string
  cedula: string
  name: string
  purchase_count: number
  created_at: string
  updated_at: string
}

export interface ClientMovement {
  id: number
  action: MovementAction
  previous_count: number
  new_count: number
  created_at: string
}
