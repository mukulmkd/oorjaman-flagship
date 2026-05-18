declare module "@react-native-community/datetimepicker" {
  import type { FC } from "react";

  export type DateTimePickerEvent = {
    type: string;
  };

  export interface DateTimePickerProps {
    value?: Date;
    mode?: "date" | "time" | "datetime";
    display?: "default" | "spinner" | "compact" | "inline";
    maximumDate?: Date;
    minimumDate?: Date;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  }

  const DateTimePicker: FC<DateTimePickerProps>;
  export default DateTimePicker;
}
