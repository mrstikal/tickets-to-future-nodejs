'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';
import type { CSSObjectWithLabel, StylesConfig } from 'react-select';
import DatePicker from 'react-datepicker';
import { format, subDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { DashboardFilters, AdminTicketTypeFilter, AdminTicketEventFilter } from '@/types/admin';
import { getAdminTicketTypes, getAdminTicketEvents } from '@/services/admin-api-client';

type DashboardFiltersProps = {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
};

type SelectOption = {
  value: string;
  label: string;
};

export default function DashboardFiltersComponent({
  filters,
  onFiltersChange,
}: DashboardFiltersProps) {
  const [ticketTypes, setTicketTypes] = useState<SelectOption[]>([]);
  const [ticketEvents, setTicketEvents] = useState<SelectOption[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    loadTicketTypes();
  }, []);

  useEffect(() => {
    if (filters.ticketTypeId) {
      loadTicketEvents(filters.ticketTypeId);
    } else {
      setTicketEvents([]);
    }
  }, [filters.ticketTypeId]);

  const loadTicketTypes = async () => {
    setIsLoadingTypes(true);
    try {
      const response = await getAdminTicketTypes();
      const options = response.items.map((item: AdminTicketTypeFilter) => ({
        value: item.id,
        label: item.title,
      }));
      setTicketTypes(options);
    } catch (error) {
      console.error('Failed to load ticket types:', error);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const loadTicketEvents = async (ticketTypeId: string) => {
    setIsLoadingEvents(true);
    try {
      const response = await getAdminTicketEvents(ticketTypeId);
      const options = response.items.map((item: AdminTicketEventFilter) => ({
        value: item.id,
        label: `${item.title} (${format(new Date(item.eventAt), 'dd.MM.yyyy', { locale: enUS })})`,
      }));
      setTicketEvents(options);
    } catch (error) {
      console.error('Failed to load ticket events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleDateRangeChange = (preset: string) => {
    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;

    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = subDays(now, 7);
        break;
      case 'month':
        startDate = subDays(now, 30);
        break;
      default:
        return;
    }

    onFiltersChange({
      ...filters,
      startDate,
      endDate,
    });
  };

  const customSelectStyles: StylesConfig<SelectOption, false> = {
    control: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: '#374151',
      borderColor: '#4B5563',
      color: 'white',
      '&:hover': {
        borderColor: '#6B7280',
      },
    }),
    menu: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: '#374151',
    }),
    option: (provided: CSSObjectWithLabel, state: { isSelected: boolean }): CSSObjectWithLabel => ({
      ...provided,
      backgroundColor: state.isSelected ? '#4B5563' : '#374151',
      color: 'white',
      '&:hover': {
        backgroundColor: '#4B5563',
      },
    }),
    singleValue: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      color: 'white',
    }),
    input: (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...provided,
      color: 'white',
    }),
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Filter</h3>

      {/* Date Range Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Period
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleDateRangeChange('today')}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
          >
            Today
          </button>
          <button
            onClick={() => handleDateRangeChange('week')}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
          >
            This week
          </button>
          <button
            onClick={() => handleDateRangeChange('month')}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
          >
            This month
          </button>
          <button
            onClick={() => handleDateRangeChange('30days')}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Last 30 days
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            From
          </label>
          <DatePicker
            selected={filters.startDate}
            onChange={(date: Date | null) =>
              onFiltersChange({ ...filters, startDate: date || undefined })
            }
            dateFormat="dd.MM.yyyy"
            locale={enUS}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholderText="Choose date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            To
          </label>
          <DatePicker
            selected={filters.endDate}
            onChange={(date: Date | null) =>
              onFiltersChange({ ...filters, endDate: date || undefined })
            }
            dateFormat="dd.MM.yyyy"
            locale={enUS}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholderText="Choose date"
          />
        </div>
      </div>

      {/* Ticket Type Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Ticket type
        </label>
        <Select
          value={
            ticketTypes.find((option) => option.value === filters.ticketTypeId) ||
            null
          }
          onChange={(option) =>
            onFiltersChange({
              ...filters,
              ticketTypeId: option?.value,
              ticketEventId: undefined, // Reset event when type changes
            })
          }
          options={ticketTypes}
          isLoading={isLoadingTypes}
          isClearable
          placeholder="All types"
          styles={customSelectStyles}
          className="text-black"
          instanceId="ticket-type"
          inputId="ticket-type-input"
        />
      </div>

      {/* Ticket Event Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Specific event
        </label>
        <Select
          value={
            ticketEvents.find((option) => option.value === filters.ticketEventId) ||
            null
          }
          onChange={(option) =>
            onFiltersChange({ ...filters, ticketEventId: option?.value })
          }
          options={ticketEvents}
          isLoading={isLoadingEvents}
          isClearable
          isDisabled={!filters.ticketTypeId}
          placeholder={
            filters.ticketTypeId ? 'Choose event' : 'First, select the ticket type'
          }
          styles={customSelectStyles}
          className="text-black"
          instanceId="ticket-event"
          inputId="ticket-event-input"
        />
      </div>
    </div>
  );
}